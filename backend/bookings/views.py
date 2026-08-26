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

from .models import Booking, Traveler, generate_booking_reference
from .serializers import (
    BookingAdminUpdateSerializer,
    BookingCreateSerializer,
    BookingDetailSerializer,
    BookingListSerializer,
    BookingOwnerUpdateSerializer,
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
CANCELLABLE_STATUSES = {Booking.BookingStatus.PENDING, Booking.BookingStatus.CONFIRMED}


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
            package = TourPackage.objects.select_for_update().get(id=requested_package.id)

            if package.status != TourPackage.Status.PUBLISHED:
                return Response(
                    {"detail": "This package is no longer available for booking."},
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

            package.available_slots -= number_of_travelers
            package.save(update_fields=["available_slots"])

            total_amount = package.effective_price * number_of_travelers

            booking = Booking.objects.create(
                booking_reference=generate_booking_reference(),
                user=request.user,
                package=package,
                travel_date=data["travel_date"],
                number_of_travelers=number_of_travelers,
                total_amount=total_amount,
                special_requests=data.get("special_requests", ""),
            )

            Traveler.objects.bulk_create(
                [Traveler(booking=booking, **traveler) for traveler in travelers_data]
            )
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
            "travelers"
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
        package = TourPackage.objects.select_for_update().get(id=booking.package_id)
        package.available_slots += booking.number_of_travelers
        package.save(update_fields=["available_slots"])

        booking.booking_status = Booking.BookingStatus.CANCELLED
        booking.save(update_fields=["booking_status", "updated_at"])

    serializer = BookingDetailSerializer(booking, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


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
