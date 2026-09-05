from django.db.models import Avg
from rest_framework import serializers

from destinations.models import Destination
from destinations.serializers import DestinationSerializer

from .models import (
    CancellationPolicy,
    CancellationRule,
    Coupon,
    PackageActivity,
    PackageExclusion,
    PackageFAQ,
    PackageImage,
    PackageInclusion,
    PackageService,
    PackageTravelDate,
    PickupPoint,
    TourPackage,
    TravelService,
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
# TravelService / PackageService / TravelDate serializers
# ---------------------------------------------------------------
class TravelServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelService
        fields = [
            "id", "service_type", "service_category", "name", "description",
            "location", "price", "unit", "is_active", "max_capacity", "extra_data",
            "created_at", "updated_at",
        ]


class PackageServiceSerializer(serializers.ModelSerializer):
    service = TravelServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=TravelService.objects.filter(is_active=True), source="service", write_only=True
    )
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PackageService
        fields = [
            "id", "service", "service_id", "quantity", "unit_price",
            "total_price", "is_included", "is_required", "is_user_selectable", "option_group", "is_default_selected", "display_order", "notes",
        ]


class PackageServiceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageService
        fields = ["service", "quantity", "unit_price", "is_included", "is_required", "is_user_selectable", "option_group", "is_default_selected", "display_order", "notes"]


class PackageTravelDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageTravelDate
        fields = ["id", "travel_date", "status", "available_slots", "price_override", "notes"]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            "id", "code", "discount_type", "discount_value", "min_booking_amount",
            "max_discount", "valid_from", "valid_until", "usage_limit", "used_count",
            "is_active", "applicable_trip_type", "created_at",
        ]


class CancellationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CancellationRule
        fields = ["id", "days_before_min", "days_before_max", "refund_percent", "description"]


class CancellationPolicySerializer(serializers.ModelSerializer):
    rules = CancellationRuleSerializer(many=True, required=False)

    class Meta:
        model = CancellationPolicy
        fields = ["id", "package", "name", "description", "is_active", "rules"]


class PickupPointSerializer(serializers.ModelSerializer):
    distance_km = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PickupPoint
        fields = ["id", "city", "name", "address", "latitude", "longitude", "is_active", "created_at", "updated_at", "distance_km"]

    def get_distance_km(self, obj):
        # If context has request lat/lng, compute distance
        lat = self.context.get("user_lat")
        lng = self.context.get("user_lng")
        if lat is not None and lng is not None:
            d = obj.distance_to(lat, lng)
            return round(d, 2) if d is not None else None
        # Also check serializer context request query
        request = self.context.get("request")
        if request:
            try:
                lat = request.query_params.get("lat") or request.data.get("lat")
                lng = request.query_params.get("lng") or request.data.get("lng")
                if lat and lng:
                    d = obj.distance_to(lat, lng)
                    return round(d, 2) if d is not None else None
            except Exception:
                pass
        return None

    def create(self, validated_data):
        rules_data = validated_data.pop("rules", [])
        policy = CancellationPolicy.objects.create(**validated_data)
        for r in rules_data:
            CancellationRule.objects.create(policy=policy, **r)
        return policy

    def update(self, instance, validated_data):
        rules_data = validated_data.pop("rules", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if rules_data is not None:
            instance.rules.all().delete()
            for r in rules_data:
                CancellationRule.objects.create(policy=instance, **r)
        return instance


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

    trip_type_display = serializers.CharField(source="get_trip_type_display", read_only=True)
    service_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    best_time_to_visit = serializers.CharField(read_only=True)
    computed_price = serializers.SerializerMethodField()
    service_cost_total = serializers.SerializerMethodField()

    def get_computed_price(self, obj):
        try:
            if obj.trip_type == obj.TripType.INDEPENDENT_PACKAGE:
                return obj.computed_independent_price
        except Exception:
            pass
        # fallback to effective_price
        try:
            if obj.trip_type == obj.TripType.INDEPENDENT_PACKAGE and hasattr(obj, 'package_services'):
                from decimal import Decimal
                total = Decimal('0')
                for ps in obj.package_services.all() if hasattr(obj, '_prefetched_objects_cache') else obj.package_services.filter(is_included=True):
                    total += ps.total_price
                return total + (obj.service_fee or Decimal('0'))
        except Exception:
            pass
        return obj.effective_price

    def get_service_cost_total(self, obj):
        try:
            if obj.trip_type == obj.TripType.INDEPENDENT_PACKAGE:
                return obj.service_cost_total
            from decimal import Decimal
            total = Decimal('0')
            for ps in obj.package_services.all() if hasattr(obj, '_prefetched_objects_cache') else obj.package_services.filter(is_included=True):
                total += ps.total_price
            return total
        except Exception:
            return None

    pickup_points = PickupPointSerializer(many=True, read_only=True)

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
            "computed_price",
            "service_cost_total",
            "is_discounted",
            "average_rating",
            "review_count",
            "max_travelers",
            "available_slots",
            "package_type",
            "trip_type",
            "trip_type_display",
            "difficulty",
            "start_date",
            "end_date",
            "pickup_location",
            "pickup_points",
            "featured_image",
            "status",
            "is_featured",
            "service_fee",
            "best_time_to_visit",
            "category",
            "independent_highlights",
            "travel_requirements",
            "flexibility_note",
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
    package_services = PackageServiceSerializer(many=True, read_only=True)
    travel_dates = PackageTravelDateSerializer(many=True, read_only=True)
    price_breakdown = serializers.SerializerMethodField()

    def get_price_breakdown(self, obj):
        if obj.trip_type != obj.TripType.INDEPENDENT_PACKAGE:
            return None
        from decimal import Decimal
        services = []
        # Use default selection logic
        selectable_groups = {}
        total = Decimal('0')
        for ps in obj.package_services.filter(is_included=True).select_related("service"):
            if ps.is_user_selectable and ps.option_group:
                if ps.option_group not in selectable_groups:
                    group_qs = obj.package_services.filter(is_included=True, is_user_selectable=True, option_group=ps.option_group).order_by('-is_default_selected', 'display_order')
                    chosen = group_qs.first()
                    selectable_groups[ps.option_group] = chosen
                continue
            services.append({
                "id": ps.id,
                "service_name": ps.service.name,
                "service_type": ps.service.service_type,
                "service_category": ps.service.service_category,
                "quantity": ps.quantity,
                "unit_price": str(ps.unit_price),
                "total_price": str(ps.total_price),
                "is_user_selectable": ps.is_user_selectable,
                "option_group": ps.option_group,
                "is_default_selected": ps.is_default_selected,
            })
            total += ps.total_price
        for chosen in selectable_groups.values():
            if chosen:
                services.append({
                    "id": chosen.id,
                    "service_name": chosen.service.name,
                    "service_type": chosen.service.service_type,
                    "service_category": chosen.service.service_category,
                    "quantity": chosen.quantity,
                    "unit_price": str(chosen.unit_price),
                    "total_price": str(chosen.total_price),
                    "is_user_selectable": chosen.is_user_selectable,
                    "option_group": chosen.option_group,
                    "is_default_selected": chosen.is_default_selected,
                })
                total += chosen.total_price
        service_fee = obj.service_fee or Decimal('0')
        final = total + service_fee
        # Also build grouped options for frontend choice UI
        option_groups = {}
        for ps in obj.package_services.filter(is_included=True, is_user_selectable=True).select_related("service"):
            option_groups.setdefault(ps.option_group or "other", []).append({
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
        return {
            "services": services,
            "option_groups": option_groups,
            "service_cost": str(total),
            "service_fee": str(service_fee),
            "final_price": str(final),
        }

    class Meta(TourPackageListSerializer.Meta):
        fields = TourPackageListSerializer.Meta.fields + [
            "description",
            "created_by_username",
            "images",
            "inclusions",
            "exclusions",
            "activities",
            "faqs",
            "package_services",
            "travel_dates",
            "price_breakdown",
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

    pickup_points = serializers.PrimaryKeyRelatedField(
        queryset=PickupPoint.objects.filter(is_active=True), many=True, required=False
    )

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
            "trip_type",
            "difficulty",
            "start_date",
            "end_date",
            "pickup_location",
            "pickup_points",
            "featured_image",
            "status",
            "is_featured",
            "service_fee",
            "best_time_to_visit",
            "category",
            "independent_highlights",
            "travel_requirements",
            "flexibility_note",
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
        pickup_points_data = validated_data.pop("pickup_points", [])

        request = self.context.get("request")
        created_by = request.user if request and request.user.is_authenticated else None

        package = TourPackage.objects.create(created_by=created_by, **validated_data)
        if pickup_points_data:
            package.pickup_points.set(pickup_points_data)

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
        pickup_points_data = validated_data.pop("pickup_points", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if pickup_points_data is not None:
            instance.pickup_points.set(pickup_points_data)

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
