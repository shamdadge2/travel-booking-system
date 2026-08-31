from datetime import date

from django.db import DatabaseError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import is_staff_or_admin
from config.pagination import StandardResultsPagination
from packages.models import TourPackage

from packages.models import Coupon

from .models import Booking, BookingService, Traveler, generate_booking_reference
from .serializers import (
    BookingAdminUpdateSerializer,
    BookingCreateSerializer,
    BookingDetailSerializer,
    BookingListSerializer,
    BookingOwnerUpdateSerializer,
    BookingServiceSerializer,
    BookingServiceUpdateSerializer,
    TravelerSerializer,
)

ORDERING_FIELDS = {
    "created_at": "created_at",
    "-created_at": "-created_at",
    "travel_date": "travel_date",
    "-travel_date": "-travel_date",
    "total_amount": "total_amount",
    "-total_amount": "-total_amount",
}

# Booking statuses a customer is still allowed to cancel from.
CANCELLABLE_STATUSES = {
    Booking.BookingStatus.PENDING,
    Booking.BookingStatus.PAYMENT_PENDING,
    Booking.BookingStatus.CONFIRMED,
    Booking.BookingStatus.SERVICES_BEING_ARRANGED,
    Booking.BookingStatus.PARTIALLY_CONFIRMED,
    Booking.BookingStatus.FULLY_CONFIRMED,
}


def _can_view_booking(user, booking):
    return bool(user and user.is_authenticated and (user == booking.user or is_staff_or_admin(user)))


# ---------------------------------------------------------------
# GET / POST /api/bookings/
#
# Both methods require nothing more than being authenticated, so a
# single uniform permission_classes list is fine here — the
# owner-vs-admin distinction is applied to *which rows* are visible,
# not to whether the endpoint can be called at all.
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def booking_list_create(request):
    if request.method == "GET":
        queryset = Booking.objects.select_related("user", "package", "package__destination")

        if is_staff_or_admin(request.user):
            user_id = request.query_params.get("user")
            if user_id:
                queryset = queryset.filter(user_id=user_id)
        else:
            queryset = queryset.filter(user=request.user)

        booking_status = request.query_params.get("booking_status")
        if booking_status:
            queryset = queryset.filter(booking_status=booking_status)

        payment_status = request.query_params.get("payment_status")
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(booking_reference__icontains=search) | Q(package__title__icontains=search)
            )

        ordering = request.query_params.get("ordering")
        if ordering in ORDERING_FIELDS:
            queryset = queryset.order_by(ORDERING_FIELDS[ordering])

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = BookingListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    # POST — create a booking
    serializer = BookingCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    requested_package = data["package"]
    number_of_travelers = data["number_of_travelers"]
    travelers_data = data["travelers"]
    coupon_code = data.get("coupon_code", "").strip()

    # The whole read-check-decrement-create sequence must be atomic and
    # the package row must be locked for the duration, otherwise two
    # concurrent requests could both read the same available_slots
    # value and both succeed, overselling the package. On PostgreSQL
    # (the intended production database), select_for_update() makes the
    # second concurrent request simply wait for the first transaction
    # to finish, then correctly see the updated slot count. SQLite has
    # no real row locking, so under concurrent load it can instead
    # raise a database-level error — caught below and turned into a
    # clean, retryable response rather than a raw 500.
    try:
        with transaction.atomic():
            package = TourPackage.objects.select_for_update().prefetch_related("package_services__service", "travel_dates").get(id=requested_package.id)

            if package.status != TourPackage.Status.PUBLISHED:
                return Response(
                    {"detail": "This package is no longer available for booking."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check max_travelers vs requested
            if number_of_travelers > package.max_travelers:
                return Response(
                    {"detail": f"Maximum {package.max_travelers} travelers allowed for this package."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if package.available_slots < number_of_travelers:
                return Response(
                    {
                        "detail": (
                            f"Only {package.available_slots} slot(s) left for this "
                            f"package — cannot book {number_of_travelers}."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Independent package specific checks
            is_independent = package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE
            if is_independent:
                travel_date = data["travel_date"]
                # Check date availability if travel_dates are configured
                if package.travel_dates.exists():
                    td = package.travel_dates.filter(travel_date=travel_date).first()
                    if not td:
                        return Response({"detail": f"Travel date {travel_date} is not available for this package."}, status=status.HTTP_400_BAD_REQUEST)
                    if td.status == "not_available":
                        return Response({"detail": f"Selected date {travel_date} is not available."}, status=status.HTTP_400_BAD_REQUEST)
                    # Limited still allows booking but warn? we allow
                    if td.available_slots is not None and td.available_slots < number_of_travelers:
                        return Response({"detail": f"Only {td.available_slots} slot(s) left for {travel_date}."}, status=status.HTTP_409_CONFLICT)
                # Check required services available
                unavailable_services = []
                for ps in package.package_services.filter(is_required=True):
                    if not ps.service.is_active:
                        unavailable_services.append(ps.service.name)
                if unavailable_services:
                    return Response({"detail": f"Cannot book — required services unavailable: {', '.join(unavailable_services)}"}, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate booking: same user, same package, same date, same travelers count pending? Optional but handle
            # Calculate pricing server-side — never trust client
            from decimal import Decimal
            if is_independent:
                service_cost_per_person = sum((ps.total_price for ps in package.package_services.filter(is_included=True)), Decimal('0'))
                service_fee = package.service_fee or Decimal('0')
                subtotal = service_cost_per_person * number_of_travelers + service_fee
            else:
                subtotal = package.effective_price * number_of_travelers
                service_cost_per_person = package.effective_price
                service_fee = Decimal('0')

            discount = Decimal('0')
            coupon_obj = None
            if coupon_code:
                try:
                    coupon_obj = Coupon.objects.get(code__iexact=coupon_code)
                    valid, msg = coupon_obj.is_valid_for_amount(subtotal)
                    if not valid:
                        return Response({"detail": f"Coupon invalid: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
                    if coupon_obj.applicable_trip_type and coupon_obj.applicable_trip_type != package.trip_type:
                        return Response({"detail": "Coupon not applicable for this package type."}, status=status.HTTP_400_BAD_REQUEST)
                    discount = coupon_obj.calculate_discount(subtotal)
                except Coupon.DoesNotExist:
                    return Response({"detail": "Invalid coupon code."}, status=status.HTTP_404_NOT_FOUND)

            total_amount = subtotal - discount
            if total_amount < 0:
                total_amount = Decimal('0')

            # Decrement slots
            package.available_slots -= number_of_travelers
            package.save(update_fields=["available_slots"])
            # Also decrement travel date slots if applicable
            if is_independent and package.travel_dates.exists():
                td = package.travel_dates.filter(travel_date=data["travel_date"]).first()
                if td and td.available_slots is not None:
                    td.available_slots -= number_of_travelers
                    if td.available_slots < 0:
                        td.available_slots = 0
                    td.save(update_fields=["available_slots"])

            # Increment coupon usage
            if coupon_obj:
                coupon_obj.used_count += 1
                coupon_obj.save(update_fields=["used_count"])

            # Create booking
            service_total_snapshot = service_cost_per_person * number_of_travelers if is_independent else None
            booking = Booking.objects.create(
                booking_reference=generate_booking_reference(),
                user=request.user,
                package=package,
                travel_date=data["travel_date"],
                number_of_travelers=number_of_travelers,
                total_amount=total_amount,
                service_total=service_total_snapshot,
                service_fee=service_fee if is_independent else None,
                discount_amount=discount,
                coupon_code=coupon_code,
                trip_type=package.trip_type,
                booking_status=Booking.BookingStatus.PENDING if not is_independent else Booking.BookingStatus.SERVICES_BEING_ARRANGED,
                special_requests=data.get("special_requests", ""),
            )

            Traveler.objects.bulk_create(
                [Traveler(booking=booking, **traveler) for traveler in travelers_data]
            )

            # For independent, create BookingService snapshots
            if is_independent:
                bs_list = []
                for ps in package.package_services.all():
                    bs_list.append(BookingService(
                        booking=booking,
                        package_service=ps,
                        service_name=ps.service.name,
                        service_type=ps.service.service_type,
                        quantity=ps.quantity,
                        unit_price=ps.unit_price,
                        total_price=ps.total_price,
                        status=BookingService.ServiceStatus.PENDING,
                    ))
                if bs_list:
                    BookingService.objects.bulk_create(bs_list)

    except DatabaseError:
        return Response(
            {
                "detail": (
                    "This package is receiving a lot of booking requests right now. "
                    "Please try again in a moment."
                )
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    detail_serializer = BookingDetailSerializer(booking, context={"request": request})
    return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------
# GET / PATCH /api/bookings/<id>/
# ---------------------------------------------------------------
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def booking_detail(request, booking_id):
    booking = get_object_or_404(
        Booking.objects.select_related("user", "package", "package__destination").prefetch_related(
            "travelers", "booking_services"
        ),
        id=booking_id,
    )

    if not _can_view_booking(request.user, booking):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = BookingDetailSerializer(booking, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    # PATCH — different allowed fields depending on who's asking.
    if is_staff_or_admin(request.user):
        serializer = BookingAdminUpdateSerializer(booking, data=request.data, partial=True)
    else:
        serializer = BookingOwnerUpdateSerializer(booking, data=request.data, partial=True)

    if serializer.is_valid():
        booking = serializer.save()
        detail_serializer = BookingDetailSerializer(booking, context={"request": request})
        return Response(detail_serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# POST /api/bookings/<id>/cancel/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    booking = get_object_or_404(Booking, id=booking_id)

    if not _can_view_booking(request.user, booking):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if booking.booking_status not in CANCELLABLE_STATUSES:
        return Response(
            {
                "detail": (
                    f"A booking with status '{booking.booking_status}' cannot be cancelled."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if booking.travel_date < date.today():
        return Response(
            {"detail": "Cannot cancel a booking whose travel date has already passed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        package = TourPackage.objects.select_for_update().prefetch_related("travel_dates").get(id=booking.package_id)
        package.available_slots += booking.number_of_travelers
        package.save(update_fields=["available_slots"])
        # Restore travel date slots if applicable
        if booking.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE or package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE:
            try:
                td = package.travel_dates.filter(travel_date=booking.travel_date).first()
                if td and td.available_slots is not None:
                    td.available_slots += booking.number_of_travelers
                    td.save(update_fields=["available_slots"])
            except Exception:
                pass

        # If coupon was used, decrement used_count? optional - keep as is for audit

        # Determine refund via cancellation policy
        refund_percent = 0
        try:
            from packages.models import CancellationPolicy
            policy = getattr(package, 'cancellation_policy', None)
            if not policy:
                policy = CancellationPolicy.objects.filter(package__isnull=True, is_active=True).first()
            if policy:
                days_before = (booking.travel_date - date.today()).days
                if days_before >= 0:
                    refund_percent = policy.get_refund_percent(days_before)
        except Exception:
            pass

        booking.booking_status = Booking.BookingStatus.CANCELLED
        # Update booking_services to cancelled if independent
        try:
            booking.booking_services.update(status=BookingService.ServiceStatus.CANCELLED)
        except Exception:
            pass
        booking.save(update_fields=["booking_status", "updated_at"])

    serializer = BookingDetailSerializer(booking, context={"request": request})
    data = serializer.data
    data["refund_percent"] = refund_percent
    return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# POST /api/bookings/travelers/<traveler_id>/id-proof/
#
# Booking creation is JSON-only (it carries a nested travelers array),
# so there's no way to attach a file at that point. This lets a file
# be attached afterward, once the traveler row already exists.
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_traveler_id_proof(request, traveler_id):
    traveler = get_object_or_404(Traveler.objects.select_related("booking"), id=traveler_id)

    if not _can_view_booking(request.user, traveler.booking):
        return Response({"detail": "Traveler not found."}, status=status.HTTP_404_NOT_FOUND)

    id_proof = request.FILES.get("id_proof")
    if not id_proof:
        return Response(
            {"id_proof": "This field is required."}, status=status.HTTP_400_BAD_REQUEST
        )

    traveler.id_proof = id_proof
    traveler.save(update_fields=["id_proof"])

    serializer = TravelerSerializer(traveler, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# PATCH /api/bookings/<booking_id>/services/<service_id>/
# Admin: update individual service status
# ---------------------------------------------------------------
@api_view(["PATCH", "PUT"])
@permission_classes([IsAuthenticated])
def booking_service_update(request, booking_id, service_id):
    booking = get_object_or_404(Booking.objects.prefetch_related("booking_services"), id=booking_id)
    if not _can_view_booking(request.user, booking):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
    if not is_staff_or_admin(request.user):
        return Response({"detail": "Only staff can update service status."}, status=status.HTTP_403_FORBIDDEN)
    bs = get_object_or_404(BookingService, id=service_id, booking=booking)
    serializer = BookingServiceUpdateSerializer(bs, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    bs = serializer.save()
    if bs.status == BookingService.ServiceStatus.CONFIRMED:
        from django.utils import timezone
        bs.confirmed_at = timezone.now()
        bs.save(update_fields=["confirmed_at"])
    # Auto-update booking status based on services
    all_services = booking.booking_services.all()
    confirmed_count = all_services.filter(status=BookingService.ServiceStatus.CONFIRMED).count()
    total = all_services.count()
    if total > 0:
        if confirmed_count == total:
            booking.booking_status = Booking.BookingStatus.FULLY_CONFIRMED
        elif confirmed_count > 0:
            booking.booking_status = Booking.BookingStatus.PARTIALLY_CONFIRMED
        else:
            booking.booking_status = Booking.BookingStatus.SERVICES_BEING_ARRANGED
        booking.save(update_fields=["booking_status", "updated_at"])
    return Response(BookingServiceSerializer(bs).data)


# ---------------------------------------------------------------
# GET /api/bookings/<id>/invoice/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_invoice(request, booking_id):
    booking = get_object_or_404(
        Booking.objects.select_related("user", "package", "package__destination").prefetch_related("travelers", "booking_services"),
        id=booking_id,
    )
    if not _can_view_booking(request.user, booking):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
    # Build invoice data
    from decimal import Decimal
    subtotal = booking.service_total or booking.total_amount
    service_fee = booking.service_fee or Decimal('0')
    discount = booking.discount_amount or Decimal('0')
    services = []
    for bs in booking.booking_services.all():
        services.append({
            "service_name": bs.service_name,
            "service_type": bs.service_type,
            "quantity": bs.quantity,
            "unit_price": str(bs.unit_price),
            "total_price": str(bs.total_price),
            "status": bs.status,
        })
    # If no booking_services but independent, fallback to package_services
    if not services and booking.package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE:
        try:
            for ps in booking.package.package_services.filter(is_included=True):
                services.append({
                    "service_name": ps.service.name,
                    "service_type": ps.service.service_type,
                    "quantity": ps.quantity,
                    "unit_price": str(ps.unit_price),
                    "total_price": str(ps.total_price),
                    "status": "pending",
                })
        except Exception:
            pass
    return Response({
        "booking_id": booking.id,
        "booking_reference": booking.booking_reference,
        "package": {"id": booking.package.id, "title": booking.package.title, "trip_type": booking.package.trip_type},
        "travel_date": booking.travel_date,
        "number_of_travelers": booking.number_of_travelers,
        "travelers": TravelerSerializer(booking.travelers.all(), many=True).data,
        "services": services,
        "service_total": str(subtotal if booking.service_total else booking.total_amount),
        "service_fee": str(service_fee),
        "discount": str(discount),
        "coupon": booking.coupon_code,
        "total_amount": str(booking.total_amount),
        "payment_status": booking.payment_status,
        "booking_status": booking.booking_status,
        "customer": {"username": booking.user.username, "email": booking.user.email, "phone": getattr(booking.user, 'phone', '')},
        "created_at": booking.created_at,
    })


# ---------------------------------------------------------------
# GET /api/bookings/stats/ (admin)
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_stats(request):
    if not is_staff_or_admin(request.user):
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    from django.db.models import Sum, Count
    from django.db.models.functions import TruncMonth
    qs = Booking.objects.select_related("package")
    total = qs.count()
    group_qs = qs.filter(package__trip_type=TourPackage.TripType.GROUP_TOUR)
    independent_qs = qs.filter(package__trip_type=TourPackage.TripType.INDEPENDENT_PACKAGE)
    group_count = group_qs.count()
    independent_count = independent_qs.count()
    revenue_total = qs.filter(payment_status="paid").aggregate(s=Sum("total_amount"))["s"] or 0
    revenue_group = group_qs.filter(payment_status="paid").aggregate(s=Sum("total_amount"))["s"] or 0
    revenue_independent = independent_qs.filter(payment_status="paid").aggregate(s=Sum("total_amount"))["s"] or 0
    # Popular destinations
    from collections import Counter
    dest_counter = Counter()
    for b in qs.select_related("package__destination"):
        dest_counter[b.package.destination.name if b.package.destination else "Unknown"] += 1
    popular_destinations = [{"name": k, "count": v} for k, v in dest_counter.most_common(5)]
    # Monthly
    monthly = list(qs.annotate(month=TruncMonth("created_at")).values("month").annotate(count=Count("id"), revenue=Sum("total_amount")).order_by("month"))
    for m in monthly:
        m["month"] = m["month"].isoformat() if m["month"] else None
        m["revenue"] = str(m["revenue"] or 0)
    # Cancellation rate
    cancelled = qs.filter(booking_status="cancelled").count()
    cancellation_rate = (cancelled / total * 100) if total else 0
    avg_value = (revenue_total / total) if total else 0
    return Response({
        "total_bookings": total,
        "group_tour_bookings": group_count,
        "independent_bookings": independent_count,
        "total_revenue": str(revenue_total),
        "group_revenue": str(revenue_group),
        "independent_revenue": str(revenue_independent),
        "popular_destinations": popular_destinations,
        "monthly": monthly,
        "cancellation_rate": round(cancellation_rate, 2),
        "average_booking_value": str(round(float(avg_value), 2)),
    })
