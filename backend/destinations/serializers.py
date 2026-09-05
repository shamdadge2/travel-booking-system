from rest_framework import serializers

from .models import Destination


class DestinationSerializer(serializers.ModelSerializer):
    full_location = serializers.SerializerMethodField()

    class Meta:
        model = Destination
        fields = [
            "id",
            "name",
            "country",
            "state",
            "city",
            "description",
            "image",
            "latitude",
            "longitude",
            "is_active",
            "is_featured",
            "full_location",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_location(self, obj):
        return ", ".join(filter(None, [obj.city, obj.state, obj.country]))

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name cannot be empty.")
        return value.strip()
