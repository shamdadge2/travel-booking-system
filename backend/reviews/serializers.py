from rest_framework import serializers

from bookings.models import Booking

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    booking_reference = serializers.CharField(source="booking.booking_reference", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "user",
            "user_username",
            "package",
            "booking",
            "booking_reference",
            "rating",
            "comment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "package", "booking", "created_at", "updated_at"]


class ReviewCreateSerializer(serializers.Serializer):
    """
    `package` is taken from the URL, not this payload — a client can't
    review a different package than the one the booking actually was
    for. `booking` tells us which specific trip is being reviewed
    (a user can have more than one booking for the same package).
    """

    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all())
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class ReviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["rating", "comment"]
