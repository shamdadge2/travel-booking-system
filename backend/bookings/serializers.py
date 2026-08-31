from datetime import date

from rest_framework import serializers

from packages.models import TourPackage

from .models import Booking, BookingService, Traveler


# ---------------------------------------------------------------
# Traveler
# ---------------------------------------------------------------
class TravelerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Traveler
        fields = [
            "id",
            "full_name",
            "age",
            "gender",
            "phone",
            "email",
            "nationality",
            "govt_id",
            "emergency_contact_name",
            "emergency_contact_phone",
            "id_proof",
            "created_at",
        ]
        read_only_fields = ["id", "id_proof", "created_at"]


class TravelerInputSerializer(serializers.Serializer):
    """
    Plain (non-Model) serializer for the nested `travelers` list on
    booking creation. Deliberately excludes `id_proof` — file uploads
    can't travel inside the same JSON payload as the booking, so ID
    proofs are added afterward via the dedicated upload endpoint.
    """

    full_name = serializers.CharField(max_length=255)
    age = serializers.IntegerField(min_value=0)
    gender = serializers.ChoiceField(choices=Traveler.Gender.choices)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=True)
    govt_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)


class BookingServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingService
        fields = ["id", "service_name", "service_type", "quantity", "unit_price", "total_price", "status", "notes", "confirmed_at"]
        read_only_fields = ["id", "confirmed_at"]


# ---------------------------------------------------------------
# Read serializers
# ---------------------------------------------------------------
class BookingPackageSummarySerializer(serializers.ModelSerializer):
    destination_name = serializers.CharField(source="destination.name", read_only=True)

    class Meta:
        model = TourPackage
        fields = [
            "id",
            "title",
            "slug",
            "featured_image",
            "destination_name",
            "duration_days",
            "duration_nights",
            "trip_type",
            "service_fee",
        ]


class BookingListSerializer(serializers.ModelSerializer):
    package = BookingPackageSummarySerializer(read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    trip_type = serializers.CharField(source="package.trip_type", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "booking_reference",
            "user",
            "user_username",
            "package",
            "trip_type",
            "travel_date",
            "number_of_travelers",
            "total_amount",
            "service_total",
            "service_fee",
            "discount_amount",
            "coupon_code",
            "booking_status",
            "payment_status",
            "created_at",
        ]


class BookingDetailSerializer(BookingListSerializer):
    travelers = TravelerSerializer(many=True, read_only=True)
    booking_services = BookingServiceSerializer(many=True, read_only=True)
    price_breakdown = serializers.SerializerMethodField()

    def get_price_breakdown(self, obj):
        from decimal import Decimal
        if obj.trip_type == "independent_package" or (obj.package and obj.package.trip_type == "independent_package"):
            return {
                "service_total": str(obj.service_total or "0"),
                "service_fee": str(obj.service_fee or "0"),
                "discount": str(obj.discount_amount or "0"),
                "coupon": obj.coupon_code,
                "final": str(obj.total_amount),
            }
        return None

    class Meta(BookingListSerializer.Meta):
        fields = BookingListSerializer.Meta.fields + [
            "special_requests",
            "travelers",
            "booking_services",
            "price_breakdown",
            "updated_at",
        ]


# ---------------------------------------------------------------
# Create serializer
# ---------------------------------------------------------------
class BookingCreateSerializer(serializers.Serializer):
    """
    Validates the *shape* of a booking request. All availability
    checking, price calculation, booking-reference generation, and
    actual object creation happen in the view inside a locked
    transaction — this serializer never touches the database to
    create anything, and never accepts a client-sent total_amount.
    """

    package = serializers.PrimaryKeyRelatedField(
        queryset=TourPackage.objects.all()
    )
    travel_date = serializers.DateField(required=False, allow_null=True)
    number_of_travelers = serializers.IntegerField(min_value=1)
    special_requests = serializers.CharField(required=False, allow_blank=True, default="")
    travelers = TravelerInputSerializer(many=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True, default="")
    selected_services = serializers.ListField(child=serializers.IntegerField(), required=False, default=list, help_text="List of PackageService ids chosen for selectable groups")

    def validate_travel_date(self, value):
        if value is None:
            return value
        if value < date.today():
            raise serializers.ValidationError("travel_date cannot be in the past.")
        return value

    def validate(self, attrs):
        # If travel_date wasn't sent (custom admin now hides it), default to the package's fixed start_date or today.
        if not attrs.get("travel_date"):
            pkg = attrs.get("package")
            if pkg and pkg.start_date:
                attrs["travel_date"] = pkg.start_date if pkg.start_date >= date.today() else date.today()
            else:
                attrs["travel_date"] = date.today()
        number_of_travelers = attrs["number_of_travelers"]
        travelers = attrs["travelers"]
        if len(travelers) != number_of_travelers:
            raise serializers.ValidationError(
                {
                    "travelers": (
                        f"You listed {len(travelers)} traveler(s) but "
                        f"number_of_travelers is {number_of_travelers}. These must match."
                    )
                }
            )
        return attrs


# ---------------------------------------------------------------
# Update serializers
# ---------------------------------------------------------------
class BookingOwnerUpdateSerializer(serializers.ModelSerializer):
    """
    What the booking's own customer is allowed to change. Deliberately
    tiny — a customer can add/edit a note, nothing financial or
    status-related.
    """

    class Meta:
        model = Booking
        fields = ["special_requests"]


class BookingAdminUpdateSerializer(serializers.ModelSerializer):
    """
    What admin/staff can change. Still excludes total_amount, user,
    package, and number_of_travelers — changing any of those safely
    would require re-running the availability/pricing logic, which is
    out of scope for a simple PATCH (use cancel + rebook instead).
    """

    class Meta:
        model = Booking
        fields = ["booking_status", "payment_status", "special_requests"]


class BookingServiceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingService
        fields = ["status", "notes"]
