from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaffRole, is_staff_or_admin
from packages.models import TourPackage

from .models import Itinerary
from .serializers import ItinerarySerializer


# ---------------------------------------------------------------
# GET / POST /api/packages/<package_id>/itinerary/
#
# Both methods share one URL, so permissions are checked manually
# per-method instead of via a single declarative permission_classes
# list: GET is public (subject to the same draft/published visibility
# rule as the package itself), POST is admin/staff only.
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def package_itinerary_list_create(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)

    if request.method == "GET":
        if package.status != TourPackage.Status.PUBLISHED and not is_staff_or_admin(
            request.user
        ):
            return Response(
                {"detail": "Package not found."}, status=status.HTTP_404_NOT_FOUND
            )
        itinerary_days = package.itinerary_days.all()
        serializer = ItinerarySerializer(itinerary_days, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # POST — create a new itinerary day
    if not is_staff_or_admin(request.user):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {"detail": "You do not have permission to perform this action."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ItinerarySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    day_number = serializer.validated_data["day_number"]
    if Itinerary.objects.filter(package=package, day_number=day_number).exists():
        return Response(
            {"day_number": f"Day {day_number} already exists for this package."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer.save(package=package)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------
# PUT / PATCH / DELETE /api/itinerary/<itinerary_id>/
#
# All three methods are admin/staff only, so a single uniform
# permission_classes list is appropriate here.
# ---------------------------------------------------------------
@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def itinerary_detail(request, itinerary_id):
    itinerary = get_object_or_404(Itinerary, id=itinerary_id)

    if request.method == "DELETE":
        itinerary.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    partial = request.method == "PATCH"
    serializer = ItinerarySerializer(itinerary, data=request.data, partial=partial)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    new_day_number = serializer.validated_data.get("day_number", itinerary.day_number)
    if (
        new_day_number != itinerary.day_number
        and Itinerary.objects.filter(package=itinerary.package, day_number=new_day_number)
        .exclude(id=itinerary.id)
        .exists()
    ):
        return Response(
            {"day_number": f"Day {new_day_number} already exists for this package."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer.save()
    return Response(serializer.data, status=status.HTTP_200_OK)
