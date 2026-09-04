from datetime import date

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import is_staff_or_admin
from bookings.models import Booking
from packages.models import TourPackage

from .models import Review
from .serializers import ReviewCreateSerializer, ReviewSerializer, ReviewUpdateSerializer


# ---------------------------------------------------------------
# GET / POST /api/packages/<package_id>/reviews/
#
# GET is public (anyone can read reviews for a package); POST
# requires the requester to actually own the booking they're
# reviewing, so a single uniform permission_classes list can't apply
# — same pattern as itineraries' list/create view.
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def package_review_list_create(request, package_id):
    package = get_object_or_404(TourPackage, id=package_id)

    if request.method == "GET":
        reviews = package.reviews.select_related("user", "booking")
        return Response(ReviewSerializer(reviews, many=True).data, status=status.HTTP_200_OK)

    # POST — create a review
    if not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    serializer = ReviewCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    booking = serializer.validated_data["booking"]

    if booking.user != request.user:
        return Response(
            {"detail": "You can only review your own bookings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if booking.package_id != package.id:
        return Response(
            {"detail": "This booking is not for this package."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Review.objects.filter(booking=booking).exists():
        return Response(
            {"detail": "You have already reviewed this booking."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ---- NEW: only allow review when trip is completed ----
    # Group & independent same rule: you must have completed your trip.
    # Requires: trip date has passed, not cancelled, and booking is in a completed/confirmed state.
    if booking.booking_status == Booking.BookingStatus.CANCELLED:
        return Response(
            {"detail": "You can only review completed trips — this booking was cancelled."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if booking.travel_date > date.today():
        return Response(
            {"detail": "You can only review after your travel date ({}) has passed. Your trip hasn't completed yet.".format(booking.travel_date)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    # Auto-complete past confirmed bookings so user isn't blocked by admin delay
    if booking.travel_date <= date.today() and booking.booking_status in (
        Booking.BookingStatus.CONFIRMED,
        Booking.BookingStatus.FULLY_CONFIRMED,
        Booking.BookingStatus.PARTIALLY_CONFIRMED,
        Booking.BookingStatus.SERVICES_BEING_ARRANGED,
    ) and booking.payment_status == Booking.PaymentStatus.PAID:
        # mark completed silently
        try:
            booking.booking_status = Booking.BookingStatus.COMPLETED
            booking.save(update_fields=["booking_status", "updated_at"])
        except Exception:
            pass
    if booking.booking_status not in (
        Booking.BookingStatus.COMPLETED,
        Booking.BookingStatus.CONFIRMED,
        Booking.BookingStatus.FULLY_CONFIRMED,
    ):
        return Response(
            {"detail": "You can only review after your trip is marked as completed. Current status is '{}' — please ensure travel is finished and booking is confirmed.".format(booking.booking_status)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        review = Review.objects.create(
            user=request.user,
            package=package,
            booking=booking,
            rating=serializer.validated_data["rating"],
            comment=serializer.validated_data.get("comment", ""),
        )
    except IntegrityError:
        # Race condition safety net: two near-simultaneous requests
        # both passing the .exists() check above before either commits.
        return Response(
            {"detail": "You have already reviewed this booking."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------
# PUT / DELETE /api/reviews/<review_id>/
# ---------------------------------------------------------------
@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def review_detail(request, review_id):
    review = get_object_or_404(Review, id=review_id)

    if request.method == "DELETE":
        # Owner can delete their own review; staff/admin can moderate
        # (delete) anyone's.
        if not (review.user == request.user or is_staff_or_admin(request.user)):
            return Response(
                {"detail": "You do not have permission to delete this review."},
                status=status.HTTP_403_FORBIDDEN,
            )
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT — only the review's own author can edit it. Staff/admin can
    # remove a review (moderation) but not rewrite someone else's.
    if review.user != request.user:
        return Response(
            {"detail": "You can only edit your own reviews."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ReviewUpdateSerializer(review, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(ReviewSerializer(review).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
