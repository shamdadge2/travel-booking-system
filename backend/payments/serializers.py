from rest_framework import serializers

from bookings.models import Booking

from .models import Payment, PaymentSettings


class PaymentBookingSummarySerializer(serializers.ModelSerializer):
    package_title = serializers.CharField(source="package.title", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "booking_reference", "package_title", "total_amount", "payment_status"]


class PaymentSerializer(serializers.ModelSerializer):
    booking = PaymentBookingSummarySerializer(read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "booking",
            "transaction_id",
            "amount",
            "payment_method",
            "payment_status",
            "reference_number",
            "razorpay_order_id",
            "razorpay_payment_id",
            "razorpay_signature",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PaymentCreateSerializer(serializers.Serializer):
    """
    Only accepts a booking reference and a payment method. `amount` is
    deliberately not a field here — the view always copies it from
    booking.total_amount, so there's no way for a client to set it.
    """

    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all())
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)


class PaymentProcessSerializer(serializers.Serializer):
    """
    `simulate_result` lets a client (or test) explicitly force a mock
    success or failure outcome. Defaults to "success" so a normal
    "pay now" click just works without the frontend needing to know
    about this parameter at all.
    """

    simulate_result = serializers.ChoiceField(
        choices=["success", "failure"], required=False, default="success"
    )


class PaymentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSettings
        fields = ["upi_id", "merchant_name", "qr_image"]


class PaymentReferenceSerializer(serializers.Serializer):
    """
    What the customer submits after completing a UPI payment in their
    own app — just the transaction reference/UTR number, so an admin
    can go verify it actually landed before marking the payment paid.
    Does NOT change payment_status itself.
    """

    reference_number = serializers.CharField(max_length=100, allow_blank=False)


class RazorpayOrderCreateSerializer(serializers.Serializer):
    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all())


class RazorpayVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=100)
    razorpay_payment_id = serializers.CharField(max_length=100)
    razorpay_signature = serializers.CharField(max_length=255)
