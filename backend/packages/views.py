from django.db.models import Avg, Count, ProtectedError, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaffRole
from config.pagination import StandardResultsPagination

from .models import PackageImage, TourPackage
from .serializers import (
    PackageImageSerializer,
    TourPackageDetailSerializer,
    TourPackageListSerializer,
    TourPackageWriteSerializer,
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
    queryset = TourPackage.objects.select_related("destination").annotate(avg_rating=Avg("reviews__rating"), review_count_annotated=Count("reviews", distinct=True)).all()
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
    queryset = TourPackage.objects.select_related("destination").annotate(avg_rating=Avg("reviews__rating"), review_count_annotated=Count("reviews", distinct=True)).all()
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
            "images", "inclusions", "exclusions", "activities", "faqs"
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
    package = get_object_or_404(TourPackage, id=package_id)

    if package.status != TourPackage.Status.PUBLISHED and not _is_staff_or_admin(request.user):
        return Response({"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND)

    requested_travelers = request.query_params.get("travelers")
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

    return Response(
        {
            "package_id": package.id,
            "status": package.status,
            "max_travelers": package.max_travelers,
            "available_slots": package.available_slots,
            "is_available": package.status == TourPackage.Status.PUBLISHED
            and package.available_slots > 0,
            "requested_travelers": requested_travelers,
            "can_accommodate_requested": can_accommodate_requested,
            "start_date": package.start_date,
            "end_date": package.end_date,
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
