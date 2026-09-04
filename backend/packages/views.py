from django.db.models import Avg, Count, ProtectedError, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaffRole
from config.pagination import StandardResultsPagination

from .models import (
    Coupon,
    PackageImage,
    PackageService,
    PackageTravelDate,
    PickupPoint,
    TourPackage,
    TravelService,
)
from .serializers import (
    CouponSerializer,
    PackageImageSerializer,
    PackageServiceSerializer,
    PackageTravelDateSerializer,
    PickupPointSerializer,
    TourPackageDetailSerializer,
    TourPackageListSerializer,
    TourPackageWriteSerializer,
    TravelServiceSerializer,
)

ORDERING_FIELDS = {
    "price": "price",
    "-price": "-price",
    "duration_days": "duration_days",
    "-duration_days": "-duration_days",
    "start_date": "start_date",
    "-start_date": "-start_date",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "title": "title",
    "-title": "-title",
}


def _is_staff_or_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.is_staff or getattr(user, "is_staff_role", False))
    )


def _apply_common_filters(request, queryset):
    """
    Shared search/filter/ordering logic used by both the main list
    endpoint and the dedicated /search/ endpoint, so they always
    behave identically. Does NOT apply the "discounted" filter —
    that one depends on a Python property (is_discounted), not a DB
    column, so callers apply it after this returns.
    """
    if _is_staff_or_admin(request.user):
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
    else:
        queryset = queryset.filter(status=TourPackage.Status.PUBLISHED)

    search = request.query_params.get("search") or request.query_params.get("q")
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(short_description__icontains=search)
            | Q(description__icontains=search)
            | Q(destination__name__icontains=search)
            | Q(destination__city__icontains=search)
        )

    package_type = request.query_params.get("package_type")
    if package_type:
        queryset = queryset.filter(package_type=package_type)

    difficulty = request.query_params.get("difficulty")
    if difficulty:
        queryset = queryset.filter(difficulty=difficulty)

    destination_id = request.query_params.get("destination")
    if destination_id:
        queryset = queryset.filter(destination_id=destination_id)

    trip_type = request.query_params.get("trip_type") or request.query_params.get("booking_type")
    if trip_type:
        queryset = queryset.filter(trip_type=trip_type)

    min_price = request.query_params.get("min_price")
    if min_price:
        queryset = queryset.filter(price__gte=min_price)

    max_price = request.query_params.get("max_price")
    if max_price:
        queryset = queryset.filter(price__lte=max_price)

    ordering = request.query_params.get("ordering")
    if ordering in ORDERING_FIELDS:
        queryset = queryset.order_by(ORDERING_FIELDS[ordering])

    return queryset


def _apply_discounted_filter(request, queryset):
    """
    discount_price < price can't be expressed as a simple field filter
    against a static value, so we filter in Python using the model's
    is_discounted property. Fine at this scale; revisit with
    F('discount_price') < F('price') if the catalog grows large.
    """
    discounted_only = request.query_params.get("discounted")
    if discounted_only and discounted_only.lower() in ("1", "true", "yes"):
        return [pkg for pkg in queryset if pkg.is_discounted]
    return queryset


# ---------------------------------------------------------------
# GET /api/packages/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_packages(request):
    queryset = TourPackage.objects.select_related("destination").prefetch_related("package_services", "package_services__service", "pickup_points").annotate(avg_rating=Avg("reviews__rating"), review_count_annotated=Count("reviews", distinct=True)).all()
    queryset = _apply_common_filters(request, queryset)
    queryset = _apply_discounted_filter(request, queryset)

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = TourPackageListSerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------
# GET /api/packages/search/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def search_packages(request):
    queryset = TourPackage.objects.select_related("destination").prefetch_related("package_services", "pickup_points").annotate(avg_rating=Avg("reviews__rating"), review_count_annotated=Count("reviews", distinct=True)).all()
    queryset = _apply_common_filters(request, queryset)
    queryset = _apply_discounted_filter(request, queryset)

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = TourPackageListSerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------
# GET /api/packages/featured/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def featured_packages(request):
    queryset = (
        TourPackage.objects.select_related("destination")
        .annotate(
            avg_rating=Avg("reviews__rating"),
            review_count_annotated=Count("reviews", distinct=True),
        )
        .filter(is_featured=True, status=TourPackage.Status.PUBLISHED)
    )

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = TourPackageListSerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------
# POST /api/packages/create/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def create_package(request):
    serializer = TourPackageWriteSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        package = serializer.save()
        detail = TourPackageDetailSerializer(package, context={"request": request})
        return Response(detail.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# GET /api/packages/<id>/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_package(request, package_id):
    package = get_object_or_404(
        TourPackage.objects.select_related("destination", "created_by")
        .annotate(
            avg_rating=Avg("reviews__rating"),
            review_count_annotated=Count("reviews", distinct=True),
        )
        .prefetch_related(
            "images", "inclusions", "exclusions", "activities", "faqs",
            "package_services", "package_services__service", "travel_dates", "pickup_points"
        ),
        id=package_id,
    )

    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)

    serializer = TourPackageDetailSerializer(package, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# PUT / PATCH /api/packages/<id>/update/
# ---------------------------------------------------------------
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_package(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    partial = request.method == "PATCH"
    serializer = TourPackageWriteSerializer(
        package, data=request.data, partial=partial, context={"request": request}
    )
    if serializer.is_valid():
        package = serializer.save()
        detail = TourPackageDetailSerializer(package, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# DELETE /api/packages/<id>/delete/
# ---------------------------------------------------------------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def delete_package(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    try:
        package.delete()
    except ProtectedError:
        booking_count = package.bookings.count()
        return Response(
            {
                "detail": (
                    f"Cannot delete '{package.title}' — it has {booking_count} "
                    "booking(s) on record. Set status to 'inactive' instead to "
                    "hide it while preserving booking history."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------
# GET /api/packages/<id>/availability/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def package_availability(request, package_id):
    package = get_object_or_404(TourPackage.objects.prefetch_related("travel_dates", "package_services__service"), id=package_id)

    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)

    requested_travelers = request.query_params.get("travelers")
    requested_date = request.query_params.get("date") or request.query_params.get("travel_date")
    can_accommodate_requested = None
    if requested_travelers is not None:
        try:
            requested_travelers = int(requested_travelers)
            can_accommodate_requested = (
                package.available_slots >= requested_travelers and requested_travelers > 0
            )
        except ValueError:
            return Response(
                {"detail": "travelers must be a positive integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # For independent packages, check date-specific availability
    date_availability = None
    services_availability = []
    is_date_available = True
    if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE and requested_date:
        try:
            from datetime import datetime
            dt = datetime.strptime(requested_date, "%Y-%m-%d").date()
            td = package.travel_dates.filter(travel_date=dt).first()
            if td:
                date_availability = {
                    "date": str(td.travel_date),
                    "status": td.status,
                    "available_slots": td.available_slots,
                    "notes": td.notes,
                }
                is_date_available = td.status != PackageTravelDate.AvailabilityStatus.NOT_AVAILABLE
                if td.available_slots is not None and requested_travelers:
                    can_accommodate_requested = td.available_slots >= requested_travelers
            else:
                # If travel_dates exist but not for this date, treat as not available if package has any dates defined
                if package.travel_dates.exists():
                    is_date_available = False
                    date_availability = {"date": requested_date, "status": "not_available", "notes": "Date not offered"}
                else:
                    is_date_available = True
        except ValueError:
            return Response({"detail": "date must be YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    # Service-level availability (for independent)
    if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE:
        for ps in package.package_services.filter(is_required=True):
            svc = ps.service
            services_availability.append({
                "service_id": svc.id,
                "service_name": svc.name,
                "service_type": svc.service_type,
                "is_available": svc.is_active,
                "quantity": ps.quantity,
            })
        # If any required service inactive, not bookable
        if any(not s["is_available"] for s in services_availability):
            is_date_available = False

    base_available = package.status == TourPackage.Status.PUBLISHED and package.available_slots > 0
    if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE and requested_date:
        base_available = base_available and is_date_available

    return Response(
        {
            "package_id": package.id,
            "trip_type": package.trip_type,
            "status": package.status,
            "max_travelers": package.max_travelers,
            "available_slots": package.available_slots,
            "is_available": base_available,
            "requested_travelers": requested_travelers,
            "can_accommodate_requested": can_accommodate_requested,
            "start_date": package.start_date,
            "end_date": package.end_date,
            "requested_date": requested_date,
            "date_availability": date_availability,
            "services_availability": services_availability,
            "travel_dates": PackageTravelDateSerializer(package.travel_dates.all(), many=True).data if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE else [],
        },
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------
# POST /api/packages/<id>/images/add/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
@parser_classes([MultiPartParser, FormParser])
def add_package_image(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    serializer = PackageImageSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save(package=package)
        # Re-serialize with request context so `image` is an absolute URL (works on Vercel)
        return Response(
            PackageImageSerializer(serializer.instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# DELETE /api/packages/images/<image_id>/delete/
# ---------------------------------------------------------------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def delete_package_image(request, image_id):
    image = get_object_or_404(PackageImage, id=image_id)
    image.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------
# Travel Services CRUD (admin)
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def travel_service_list_create(request):
    if request.method == "GET":
        queryset = TravelService.objects.all()
        service_type = request.query_params.get("service_type")
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        is_active = request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(location__icontains=search))
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = TravelServiceSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    # POST
    if not _is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    serializer = TravelServiceSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([AllowAny])
def travel_service_detail(request, service_id):
    service = get_object_or_404(TravelService, id=service_id)
    if request.method == "GET":
        return Response(TravelServiceSerializer(service).data)
    if not _is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "DELETE":
        # Don't allow delete if PackageService references it
        if PackageService.objects.filter(service=service).exists():
            return Response({"detail": "Cannot delete service — it is used in one or more packages. Deactivate it instead."}, status=status.HTTP_409_CONFLICT)
        service.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    partial = request.method == "PATCH"
    serializer = TravelServiceSerializer(service, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# Package Services — list / manage per package
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def package_services_list(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)
    services = package.package_services.select_related("service").all()
    serializer = PackageServiceSerializer(services, many=True)
    # price breakdown
    from decimal import Decimal
    service_cost = sum((ps.total_price for ps in services if ps.is_included), Decimal('0'))
    service_fee = package.service_fee or Decimal('0')
    final = service_cost + service_fee
    return Response({
        "package_id": package.id,
        "trip_type": package.trip_type,
        "services": serializer.data,
        "service_cost": str(service_cost),
        "service_fee": str(service_fee),
        "final_price": str(final),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def package_service_add(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    serializer = PackageServiceSerializer(data=request.data)
    if serializer.is_valid():
        # if unit_price not provided, use service price
        service = serializer.validated_data["service"]
        if not serializer.validated_data.get("unit_price"):
            serializer.validated_data["unit_price"] = service.price
        serializer.save(package=package)
        return Response(PackageServiceSerializer(serializer.instance).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def package_service_detail(request, ps_id):
    ps = get_object_or_404(PackageService, id=ps_id)
    if request.method == "DELETE":
        ps.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    partial = request.method == "PATCH"
    serializer = PackageServiceSerializer(ps, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def package_service_reorder(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    order = request.data.get("order", [])
    if not isinstance(order, list):
        return Response({"detail": "order must be a list of package_service ids"}, status=status.HTTP_400_BAD_REQUEST)
    for idx, ps_id in enumerate(order):
        PackageService.objects.filter(id=ps_id, package=package).update(display_order=idx)
    return Response({"detail": "Reordered"})


# ---------------------------------------------------------------
# Package Travel Dates
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def package_travel_dates(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    if request.method == "GET":
        if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
            return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)
        dates = package.travel_dates.all()
        return Response(PackageTravelDateSerializer(dates, many=True).data)
    # POST create
    if not _is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    serializer = PackageTravelDateSerializer(data=request.data)
    if serializer.is_valid():
        if PackageTravelDate.objects.filter(package=package, travel_date=serializer.validated_data["travel_date"]).exists():
            return Response({"travel_date": "This date already exists for the package."}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(package=package)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def package_travel_date_detail(request, date_id):
    td = get_object_or_404(PackageTravelDate, id=date_id)
    if request.method == "DELETE":
        td.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    partial = request.method == "PATCH"
    serializer = PackageTravelDateSerializer(td, data=request.data, partial=partial)
    if serializer.is_valid():
        # check uniqueness if date changed
        new_date = serializer.validated_data.get("travel_date", td.travel_date)
        if new_date != td.travel_date and PackageTravelDate.objects.filter(package=td.package, travel_date=new_date).exclude(id=td.id).exists():
            return Response({"travel_date": "This date already exists for the package."}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# Price calculation (server-computed, never trust client)
# ---------------------------------------------------------------
@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def package_price_calculate(request, package_id):
    package = get_object_or_404(TourPackage.objects.prefetch_related("package_services__service"), id=package_id)
    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)
    # travelers can come from query or body
    travelers = request.data.get("travelers") or request.query_params.get("travelers") or 1
    try:
        travelers = int(travelers)
        if travelers < 1:
            raise ValueError()
    except (ValueError, TypeError):
        return Response({"detail": "travelers must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)
    coupon_code = request.data.get("coupon_code") or request.query_params.get("coupon_code") or request.data.get("coupon") or ""
    selected_services = request.data.get("selected_services") or request.query_params.getlist("selected_services") or []
    # normalize selected_services from query string like ?selected_services=1,2,3
    if isinstance(selected_services, str):
        selected_services = [x.strip() for x in selected_services.split(",") if x.strip()]
    # flatten if list contains comma-separated
    flat = []
    for item in selected_services:
        if isinstance(item, str) and "," in item:
            flat.extend([x.strip() for x in item.split(",") if x.strip()])
        else:
            flat.append(item)
    selected_services = flat
    # convert to ints where possible
    sel_ids = []
    for sid in selected_services:
        try:
            sel_ids.append(int(sid))
        except Exception:
            pass

    from decimal import Decimal
    if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE:
        if sel_ids:
            service_cost_per_person = package.compute_price_for_selection(sel_ids) - (package.service_fee or Decimal('0'))
            service_fee = package.service_fee or Decimal('0')
        else:
            service_cost_per_person = sum((ps.total_price for ps in package.package_services.filter(is_included=True) if not (ps.is_user_selectable and ps.option_group)), Decimal('0'))
            # add default selectable groups
            selectable_groups = {}
            for ps in package.package_services.filter(is_included=True, is_user_selectable=True):
                if ps.option_group not in selectable_groups:
                    grp = package.package_services.filter(is_included=True, is_user_selectable=True, option_group=ps.option_group).order_by('-is_default_selected', 'display_order').first()
                    selectable_groups[ps.option_group] = grp
            for grp_ps in selectable_groups.values():
                if grp_ps:
                    service_cost_per_person += grp_ps.total_price
            service_fee = package.service_fee or Decimal('0')
            # Alternative simpler: service_cost_per_person = package.compute_price_for_selection(None) - fee
            try:
                service_cost_per_person = package.compute_price_for_selection(None) - service_fee
            except Exception:
                pass
        subtotal = service_cost_per_person * travelers + service_fee
    else:
        subtotal = package.effective_price * travelers
        service_cost_per_person = package.effective_price
        service_fee = Decimal('0')
        service_cost = subtotal

    # Coupon handling
    discount = Decimal('0')
    coupon_valid = None
    coupon_msg = None
    if coupon_code:
        try:
            coupon = Coupon.objects.get(code__iexact=coupon_code.strip())
            valid, msg = coupon.is_valid_for_amount(subtotal)
            if valid and (not coupon.applicable_trip_type or coupon.applicable_trip_type == package.trip_type):
                discount = coupon.calculate_discount(subtotal)
                coupon_valid = True
                coupon_msg = "Coupon applied"
            else:
                coupon_valid = False
                coupon_msg = msg if not valid else "Coupon not applicable for this package type"
                discount = Decimal('0')
        except Coupon.DoesNotExist:
            coupon_valid = False
            coupon_msg = "Invalid coupon code"
            discount = Decimal('0')

    final_amount = subtotal - discount
    if final_amount < 0:
        final_amount = Decimal('0')

    # Build breakdown with selectable groups detail
    services_breakdown = []
    option_groups_breakdown = {}
    if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE:
        if sel_ids:
            # build from selected + non-selectable
            for ps in package.package_services.filter(is_included=True):
                if ps.is_user_selectable:
                    if ps.id in sel_ids:
                        services_breakdown.append({
                            "service_name": ps.service.name,
                            "service_type": ps.service.service_type,
                            "quantity": ps.quantity,
                            "unit_price": str(ps.unit_price),
                            "total_price": str(ps.total_price),
                            "is_user_selectable": ps.is_user_selectable,
                            "option_group": ps.option_group,
                        })
                else:
                    services_breakdown.append({
                        "service_name": ps.service.name,
                        "service_type": ps.service.service_type,
                        "quantity": ps.quantity,
                        "unit_price": str(ps.unit_price),
                        "total_price": str(ps.total_price),
                        "is_user_selectable": ps.is_user_selectable,
                        "option_group": ps.option_group,
                    })
        else:
            for ps in package.package_services.filter(is_included=True):
                # skip selectable non-default for default view
                if ps.is_user_selectable and ps.option_group:
                    grp = package.package_services.filter(is_included=True, is_user_selectable=True, option_group=ps.option_group).order_by('-is_default_selected', 'display_order').first()
                    if grp and grp.id != ps.id:
                        continue
                services_breakdown.append({
                    "service_name": ps.service.name,
                    "service_type": ps.service.service_type,
                    "quantity": ps.quantity,
                    "unit_price": str(ps.unit_price),
                    "total_price": str(ps.total_price),
                    "is_user_selectable": ps.is_user_selectable,
                    "option_group": ps.option_group,
                })
        for ps in package.package_services.filter(is_included=True, is_user_selectable=True).select_related("service"):
            option_groups_breakdown.setdefault(ps.option_group or "other", []).append({
                "id": ps.id,
                "service_name": ps.service.name,
                "service_type": ps.service.service_type,
                "service_category": ps.service.service_category,
                "description": ps.service.description,
                "location": ps.service.location,
                "price": str(ps.unit_price),
                "total_price": str(ps.total_price),
                "quantity": ps.quantity,
                "is_default_selected": ps.is_default_selected,
                "extra_data": ps.service.extra_data,
            })

    return Response({
        "package_id": package.id,
        "trip_type": package.trip_type,
        "travelers": travelers,
        "service_cost_per_person": str(service_cost_per_person) if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE else None,
        "services": services_breakdown,
        "option_groups": option_groups_breakdown,
        "selected_services": sel_ids,
        "service_cost": str(service_cost_per_person * travelers) if package.trip_type == TourPackage.TripType.INDEPENDENT_PACKAGE else str(subtotal),
        "service_fee": str(service_fee),
        "subtotal": str(subtotal),
        "coupon_code": coupon_code,
        "coupon_valid": coupon_valid,
        "coupon_message": coupon_msg,
        "discount": str(discount),
        "final_amount": str(final_amount),
    })


# ---------------------------------------------------------------
# Coupon validation endpoint
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def validate_coupon(request):
    code = request.data.get("code") or request.data.get("coupon_code") or ""
    amount = request.data.get("amount") or 0
    try:
        from decimal import Decimal
        amount = Decimal(str(amount))
    except Exception:
        amount = Decimal('0')
    if not code:
        return Response({"valid": False, "detail": "Coupon code required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        coupon = Coupon.objects.get(code__iexact=code.strip())
    except Coupon.DoesNotExist:
        return Response({"valid": False, "detail": "Invalid coupon"}, status=status.HTTP_404_NOT_FOUND)
    valid, msg = coupon.is_valid_for_amount(amount)
    if not valid:
        return Response({"valid": False, "detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    discount = coupon.calculate_discount(amount)
    return Response({"valid": True, "discount": str(discount), "final_amount": str(amount - discount), "detail": msg})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def coupon_list_create(request):
    if request.method == "GET":
        qs = Coupon.objects.all().order_by("-created_at")
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(CouponSerializer(page, many=True).data)
    serializer = CouponSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def coupon_detail(request, coupon_id):
    coupon = get_object_or_404(Coupon, id=coupon_id)
    if request.method == "GET":
        return Response(CouponSerializer(coupon).data)
    if request.method == "DELETE":
        coupon.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    partial = request.method == "PATCH"
    serializer = CouponSerializer(coupon, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# Pickup Points — admin can add big cities as hubs, user gets nearest suggestion
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def pickup_point_list_create(request):
    if request.method == "GET":
        qs = PickupPoint.objects.all().order_by("city", "name")
        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(city__icontains=search) | Q(name__icontains=search) | Q(address__icontains=search))
        # optional nearest sorting if lat/lng provided
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        if lat and lng:
            try:
                lat_f = float(lat)
                lng_f = float(lng)
                # sort by distance where coords exist
                points = list(qs)
                for p in points:
                    d = p.distance_to(lat_f, lng_f)
                    p._distance = d if d is not None else float('inf')
                points.sort(key=lambda x: x._distance)
                paginator = StandardResultsPagination()
                page = paginator.paginate_queryset(points, request)
                # must serialize manually with distance context
                ser = PickupPointSerializer(page, many=True, context={"request": request, "user_lat": lat_f, "user_lng": lng_f})
                return paginator.get_paginated_response(ser.data)
            except Exception:
                pass
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(PickupPointSerializer(page, many=True, context={"request": request}).data)

    # POST — admin only
    if not _is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    serializer = PickupPointSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([AllowAny])
def pickup_point_detail(request, point_id):
    point = get_object_or_404(PickupPoint, id=point_id)
    if request.method == "GET":
        lat = request.query_params.get("lat")
        if not lat and hasattr(request, 'data') and request.data:
            lat = request.data.get("lat")
        lng = request.query_params.get("lng")
        if not lng and hasattr(request, 'data') and request.data:
            lng = request.data.get("lng")
        ctx = {"request": request}
        if lat and lng:
            try:
                ctx["user_lat"] = float(lat)
                ctx["user_lng"] = float(lng)
            except Exception:
                pass
        return Response(PickupPointSerializer(point, context=ctx).data)
    if not _is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "DELETE":
        if point.packages.exists():
            return Response({"detail": "Cannot delete pickup point — it is assigned to one or more packages. Unassign first or deactivate."}, status=status.HTTP_409_CONFLICT)
        point.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    partial = request.method == "PATCH"
    serializer = PickupPointSerializer(point, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([AllowAny])
def package_pickup_points(request, package_id):
    package = get_object_or_404(TourPackage.objects.prefetch_related("pickup_points"), id=package_id)
    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)
    points = package.pickup_points.filter(is_active=True).order_by("city", "name")
    # if lat/lng provided, compute distance and sort nearest first, include distance_km
    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    ctx = {"request": request}
    if lat and lng:
        try:
            lat_f = float(lat)
            lng_f = float(lng)
            ctx["user_lat"] = lat_f
            ctx["user_lng"] = lng_f
            # sort
            points_list = list(points)
            for p in points_list:
                d = p.distance_to(lat_f, lng_f)
                p._distance = d if d is not None else float('inf')
            points_list.sort(key=lambda x: getattr(x, "_distance", float('inf')))
            points = points_list
        except Exception:
            pass
    serializer = PickupPointSerializer(points, many=True, context=ctx)
    # optionally also return nearest
    data = serializer.data
    nearest = None
    if lat and lng and data:
        # data already sorted by distance, first is nearest if distance not None
        nearest = data[0] if data[0].get("distance_km") is not None else None
    return Response({"package_id": package.id, "pickup_points": data, "nearest": nearest, "count": len(data)})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def package_pickup_point_assign(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)
    pickup_ids = request.data.get("pickup_points") or request.data.get("pickup_point_ids") or []
    if isinstance(pickup_ids, int):
        pickup_ids = [pickup_ids]
    if not isinstance(pickup_ids, list):
        return Response({"detail": "pickup_points must be a list of ids"}, status=status.HTTP_400_BAD_REQUEST)
    # validate ids
    valid = PickupPoint.objects.filter(id__in=pickup_ids, is_active=True)
    package.pickup_points.set(valid)
    return Response(PickupPointSerializer(package.pickup_points.all(), many=True).data)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def nearest_pickup_point(request):
    # Global nearest across all active points (fallback if package has none)
    lat = request.query_params.get("lat")
    if not lat and hasattr(request, 'data') and request.data:
        lat = request.data.get("lat")
    lng = request.query_params.get("lng")
    if not lng and hasattr(request, 'data') and request.data:
        lng = request.data.get("lng")
    if not lat or not lng:
        return Response({"detail": "lat and lng required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except ValueError:
        return Response({"detail": "lat/lng must be numbers"}, status=status.HTTP_400_BAD_REQUEST)
    package_id = request.query_params.get("package_id")
    if not package_id and hasattr(request, 'data') and request.data:
        package_id = request.data.get("package_id")
    if package_id:
        try:
            package = TourPackage.objects.prefetch_related("pickup_points").get(id=int(package_id))
            points = list(package.pickup_points.filter(is_active=True))
            if points:
                best = min(points, key=lambda p: p.distance_to(lat_f, lng_f) if p.distance_to(lat_f, lng_f) is not None else float('inf'))
                return Response(PickupPointSerializer(best, context={"user_lat": lat_f, "user_lng": lng_f}).data)
        except Exception:
            pass
    # fallback global
    points = list(PickupPoint.objects.filter(is_active=True))
    if not points:
        return Response({"detail": "No pickup points configured"}, status=status.HTTP_404_NOT_FOUND)
    # filter only those with coords
    with_coords = [p for p in points if p.latitude is not None and p.longitude is not None]
    search_pool = with_coords if with_coords else points
    best = min(search_pool, key=lambda p: p.distance_to(lat_f, lng_f) if p.distance_to(lat_f, lng_f) is not None else float('inf'))
    return Response(PickupPointSerializer(best, context={"user_lat": lat_f, "user_lng": lng_f}).data)
