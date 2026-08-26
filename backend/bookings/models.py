import secrets
import string

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from packages.models import TourPackage


def generate_booking_reference():
    """
    Generates a unique, human-shareable booking reference like
    "TB7K3F9QZ2". Checked against the database in a loop — with an
    8-character alphanumeric suffix the collision odds are astronomically
    low, but we verify uniqueness explicitly rather than assuming it.
    """
    alphabet = string.ascii_uppercase + string.digits
    while True:
        candidate = "TB" + "".join(secrets.choice(alphabet) for _ in range(8))
        if not Booking.objects.filter(booking_reference=candidate).exists():
            return candidate


def traveler_id_proof_path(instance, filename):
    return f"travelers/booking_{instance.booking_id}/{filename}"


class Booking(models.Model):
    class BookingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    booking_reference = models.CharField(max_length=20, unique=True, editable=False)

    # PROTECT: a user or package with existing bookings can't be hard-deleted
    # out from under those booking/financial records. See accounts/views.py
    # and packages/views.py for the graceful 409 handling this requires.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings"
    )
    package = models.ForeignKey(
        TourPackage, on_delete=models.PROTECT, related_name="bookings"
    )

    travel_date = models.DateField()
    number_of_travelers = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    # Always computed server-side at booking time — never trust a client-sent amount.
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    booking_status = models.CharField(
        max_length=20, choices=BookingStatus.choices, default=BookingStatus.PENDING
    )
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    special_requests = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bookings"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["booking_status"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["booking_reference"]),
        ]

    def __str__(self):
        return f"{self.booking_reference} ({self.user.username})"


class Traveler(models.Model):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="travelers")
    full_name = models.CharField(max_length=255)
    age = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    gender = models.CharField(max_length=10, choices=Gender.choices)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    id_proof = models.FileField(
        upload_to=traveler_id_proof_path, blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "travelers"
        ordering = ["id"]

    def __str__(self):
        return f"{self.full_name} ({self.booking.booking_reference})"
