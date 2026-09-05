from django.db.models import ProtectedError, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaffRole
from config.pagination import StandardResultsPagination

from .models import Destination
from .serializers import DestinationSerializer

ORDERING_FIELDS = {
    "name": "name",
    "-name": "-name",
    "country": "country",
    "-country": "-country",
    "created_at": "created_at",
    "-created_at": "-created_at",
}


def _is_staff_or_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.is_staff or getattr(user, "is_staff_role", False))
    )


# ---------------------------------------------------------------
# GET /api/destinations/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_destinations(request):
    queryset = Destination.objects.all()

    # Non-staff visitors only ever see active destinations. Staff/admin
    # can pass ?is_active=false to review inactive/draft entries too.
    if _is_staff_or_admin(request.user):
        is_active_param = request.query_params.get("is_active")
        if is_active_param is not None:
            queryset = queryset.filter(
                is_active=is_active_param.lower() in ("1", "true", "yes")
            )
    else:
        queryset = queryset.filter(is_active=True)

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(country__icontains=search)
            | Q(state__icontains=search)
            | Q(city__icontains=search)
            | Q(description__icontains=search)
        )

    # Featured filter for homepage: ?is_featured=true
    is_featured_param = request.query_params.get("is_featured")
    if is_featured_param is not None:
        queryset = queryset.filter(is_featured=is_featured_param.lower() in ("1", "true", "yes"))

    country = request.query_params.get("country")
    if country:
        queryset = queryset.filter(country__iexact=country)

    state = request.query_params.get("state")
    if state:
        queryset = queryset.filter(state__iexact=state)

    city = request.query_params.get("city")
    if city:
        queryset = queryset.filter(city__iexact=city)

    ordering = request.query_params.get("ordering")
    if ordering in ORDERING_FIELDS:
        queryset = queryset.order_by(ORDERING_FIELDS[ordering])

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = DestinationSerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------
# POST /api/destinations/create/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def create_destination(request):
    serializer = DestinationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# GET /api/destinations/<id>/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_destination(request, destination_id):
    destination = get_object_or_404(Destination, id=destination_id)

    if not destination.is_active and not _is_staff_or_admin(request.user):
        return Response(
            {"detail": "Destination not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = DestinationSerializer(destination, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# PUT / PATCH /api/destinations/<id>/update/
# ---------------------------------------------------------------
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_destination(request, destination_id):
    destination = get_object_or_404(Destination, id=destination_id)
    partial = request.method == "PATCH"
    serializer = DestinationSerializer(destination, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# DELETE /api/destinations/<id>/delete/
# ---------------------------------------------------------------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def delete_destination(request, destination_id):
    destination = get_object_or_404(Destination, id=destination_id)
    try:
        destination.delete()
    except ProtectedError:
        package_count = destination.packages.count()
        return Response(
            {
                "detail": (
                    f"Cannot delete '{destination.name}' — it is still referenced by "
                    f"{package_count} tour package(s). Reassign or delete those "
                    "packages first, or set is_active=false to hide it instead."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)
