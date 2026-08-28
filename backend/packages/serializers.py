from django.db.models import Avg
from rest_framework import serializers

from destinations.models import Destination
from destinations.serializers import DestinationSerializer

from .models import (
    PackageActivity,
    PackageExclusion,
    PackageFAQ,
    PackageImage,
    PackageInclusion,
    TourPackage,
)


# ---------------------------------------------------------------
# Child model serializers (read + write)
# ---------------------------------------------------------------
class PackageImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageImage
        fields = ["id", "image", "place_name", "caption", "display_order"]
        extra_kwargs = {
            "display_order": {"required": False},
            "place_name": {"required": False, "allow_blank": True},
            "caption": {"required": False, "allow_blank": True},
        }


class PackageInclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageInclusion
        fields = ["id", "item"]


class PackageExclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageExclusion
        fields = ["id", "item"]


class PackageActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageActivity
        fields = ["id", "title", "description", "day_number", "duration"]


class PackageFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageFAQ
        fields = ["id", "question", "answer"]


# ---------------------------------------------------------------
# Read serializers
# ---------------------------------------------------------------
class TourPackageListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list/search/featured endpoints. Excludes
    the heavier nested collections (images, inclusions, etc.) which
    only the detail endpoint returns.
    """

    destination_name = serializers.CharField(source="destination.name", read_only=True)
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    is_discounted = serializers.BooleanField(read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    def get_average_rating(self, obj):
        # Annotated by the view when possible (see views.py); falls
        # back to a live aggregate query if the annotation is missing
        # (e.g. this serializer used somewhere without that optimization).
        if hasattr(obj, "avg_rating"):
            return round(obj.avg_rating, 1) if obj.avg_rating is not None else None
        result = obj.reviews.aggregate(avg=Avg("rating"))
        return round(result["avg"], 1) if result["avg"] is not None else None

    def get_review_count(self, obj):
        if hasattr(obj, "review_count_annotated"):
            return obj.review_count_annotated
        return obj.reviews.count()

    class Meta:
        model = TourPackage
        fields = [
            "id",
            "title",
            "slug",
            "destination",
            "destination_name",
            "short_description",
            "duration_days",
            "duration_nights",
            "price",
            "discount_price",
            "effective_price",
            "is_discounted",
            "average_rating",
            "review_count",
            "max_travelers",
            "available_slots",
            "package_type",
            "difficulty",
            "start_date",
            "end_date",
            "pickup_location",
            "featured_image",
            "status",
            "is_featured",
            "created_at",
        ]


class TourPackageDetailSerializer(TourPackageListSerializer):
    """
    Full serializer for the package detail endpoint. Includes the
    destination object, creator username, and every related
    collection (images, inclusions, exclusions, activities, FAQs).
    """

    destination = DestinationSerializer(read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )
    images = PackageImageSerializer(many=True, read_only=True)
    inclusions = PackageInclusionSerializer(many=True, read_only=True)
    exclusions = PackageExclusionSerializer(many=True, read_only=True)
    activities = PackageActivitySerializer(many=True, read_only=True)
    faqs = PackageFAQSerializer(many=True, read_only=True)

    class Meta(TourPackageListSerializer.Meta):
        fields = TourPackageListSerializer.Meta.fields + [
            "description",
            "created_by_username",
            "images",
            "inclusions",
            "exclusions",
            "activities",
            "faqs",
            "updated_at",
        ]


# ---------------------------------------------------------------
# Write serializer (create / update)
# ---------------------------------------------------------------
class TourPackageWriteSerializer(serializers.ModelSerializer):
    """
    Handles create + update for packages, including nested writable
    lists for inclusions / exclusions / activities / FAQs (all plain
    text, so they can safely travel inside one JSON payload).

    Package images are NOT handled here — they require file uploads
    and are managed through the dedicated
    POST /api/packages/<id>/images/add/ and
    DELETE /api/packages/images/<image_id>/delete/ endpoints instead.
    """

    destination = serializers.PrimaryKeyRelatedField(
        queryset=Destination.objects.filter(is_active=True)
    )
    inclusions = PackageInclusionSerializer(many=True, required=False)
    exclusions = PackageExclusionSerializer(many=True, required=False)
    activities = PackageActivitySerializer(many=True, required=False)
    faqs = PackageFAQSerializer(many=True, required=False)

    class Meta:
        model = TourPackage
        fields = [
            "id",
            "title",
            "destination",
            "short_description",
            "description",
            "duration_days",
            "duration_nights",
            "price",
            "discount_price",
            "max_travelers",
            "available_slots",
            "package_type",
            "difficulty",
            "start_date",
            "end_date",
            "pickup_location",
            "featured_image",
            "status",
            "is_featured",
            "inclusions",
            "exclusions",
            "activities",
            "faqs",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        discount_price = attrs.get(
            "discount_price", getattr(self.instance, "discount_price", None)
        )
        if discount_price is not None and price is not None and discount_price >= price:
            raise serializers.ValidationError(
                {"discount_price": "Discount price must be less than the regular price."}
            )

        max_travelers = attrs.get(
            "max_travelers", getattr(self.instance, "max_travelers", None)
        )
        available_slots = attrs.get(
            "available_slots", getattr(self.instance, "available_slots", None)
        )
        if (
            max_travelers is not None
            and available_slots is not None
            and available_slots > max_travelers
        ):
            raise serializers.ValidationError(
                {"available_slots": "Available slots cannot exceed max travelers."}
            )

        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before the start date."}
            )

        return attrs

    def create(self, validated_data):
        inclusions_data = validated_data.pop("inclusions", [])
        exclusions_data = validated_data.pop("exclusions", [])
        activities_data = validated_data.pop("activities", [])
        faqs_data = validated_data.pop("faqs", [])

        request = self.context.get("request")
        created_by = request.user if request and request.user.is_authenticated else None

        package = TourPackage.objects.create(created_by=created_by, **validated_data)

        PackageInclusion.objects.bulk_create(
            [PackageInclusion(package=package, **item) for item in inclusions_data]
        )
        PackageExclusion.objects.bulk_create(
            [PackageExclusion(package=package, **item) for item in exclusions_data]
        )
        PackageActivity.objects.bulk_create(
            [PackageActivity(package=package, **item) for item in activities_data]
        )
        PackageFAQ.objects.bulk_create(
            [PackageFAQ(package=package, **item) for item in faqs_data]
        )

        return package

    def update(self, instance, validated_data):
        inclusions_data = validated_data.pop("inclusions", None)
        exclusions_data = validated_data.pop("exclusions", None)
        activities_data = validated_data.pop("activities", None)
        faqs_data = validated_data.pop("faqs", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Only replace a child collection if the client actually sent
        # that key — omitting it means "leave these alone", sending an
        # empty list means "clear them all".
        if inclusions_data is not None:
            instance.inclusions.all().delete()
            PackageInclusion.objects.bulk_create(
                [PackageInclusion(package=instance, **item) for item in inclusions_data]
            )
        if exclusions_data is not None:
            instance.exclusions.all().delete()
            PackageExclusion.objects.bulk_create(
                [PackageExclusion(package=instance, **item) for item in exclusions_data]
            )
        if activities_data is not None:
            instance.activities.all().delete()
            PackageActivity.objects.bulk_create(
                [PackageActivity(package=instance, **item) for item in activities_data]
            )
        if faqs_data is not None:
            instance.faqs.all().delete()
            PackageFAQ.objects.bulk_create(
                [PackageFAQ(package=instance, **item) for item in faqs_data]
            )

        return instance
