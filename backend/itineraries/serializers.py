from rest_framework import serializers

from .models import Itinerary


class ItinerarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Itinerary
        fields = [
            "id",
            "package",
            "day_number",
            "title",
            "description",
            "activities",
            "meals",
            "accommodation",
            "location",
            "created_at",
            "updated_at",
        ]
        # `package` is always taken from the URL (/packages/<id>/itinerary/),
        # never from the request body — a client can't reassign a day to a
        # different package by editing this field.
        read_only_fields = ["id", "package", "created_at", "updated_at"]

    def validate_day_number(self, value):
        if value < 1:
            raise serializers.ValidationError("day_number must be 1 or greater.")
        return value
