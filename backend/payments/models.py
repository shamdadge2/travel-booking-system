import secrets
import string

from django.core.validators import MinValueValidator
from django.db import models

from bookings.models import Booking


def generate_transaction_id():
    """
    Generates a unique mock transaction ID like "PAY7K3F9QZ2A".
    Checked against the database in a loop, same approach as
    bookings.models.generate_booking_reference.
    """
    alphabet = string.ascii_uppercase + string.digits
    while True:
        candidate = "PAY" + "".join(secrets.choice(alphabet) for _ in range(9))
        if not Payment.objects.filter(transaction_id=candidate).exists():
            return candidate


class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        CARD = "card", "Card"
        UPI = "upi", "UPI"
        NETBANKING = "netbanking", "Net Banking"
        MOCK = "mock", "Mock"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payments")
    transaction_id = models.CharField(max_length=20, unique=True, editable=False)

    # Always copied from booking.total_amount at creation time — never
    # trust a client-sent amount.
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )

    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        help_text=(
            "UPI transaction reference/UTR number the customer provides after "
            "paying. Used by an admin to manually verify the payment actually "
            "arrived before marking it paid — customers cannot mark their own "
            "UPI payment as paid."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["payment_status"]),
            models.Index(fields=["transaction_id"]),
        ]

    def __str__(self):
        return f"{self.transaction_id} ({self.payment_status})"


class PaymentSettings(models.Model):
    """
    Singleton-style settings row: the UPI account bookings get paid
    into. Admin sets this once via Django admin (or the API below);
    the frontend reads it to build a prefilled UPI deep link
    (upi://pay?pa=...&am=...) so tapping "Pay" opens the customer's
    UPI app (PhonePe, GPay, Paytm, etc.) with the amount already
    filled in — no real payment gateway integration required.
    """

    upi_id = models.CharField(
        max_length=100,
        help_text="Admin's UPI ID that receives payments, e.g. 'travelbooking@okhdfcbank'.",
    )
    merchant_name = models.CharField(
        max_length=100,
        default="Travel Booking System",
        help_text="Name shown to the customer in their UPI app.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment_settings"
        verbose_name = "Payment Settings"
        verbose_name_plural = "Payment Settings"

    def __str__(self):
        return f"Payment settings ({self.upi_id})"

    @classmethod
    def get_current(cls):
        return cls.objects.order_by("-updated_at").first()
