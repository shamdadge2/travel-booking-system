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
        PAYMENT_PENDING = "payment_pending", "Payment Pending"
        CONFIRMED = "confirmed", "Confirmed"
        SERVICES_BEING_ARRANGED = "services_being_arranged", "Services Being Arranged"
        PARTIALLY_CONFIRMED = "partially_confirmed", "Partially Confirmed"
        FULLY_CONFIRMED = "fully_confirmed", "Fully Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"
        REFUND_PROCESSING = "refund_processing", "Refund Processing"
        REFUNDED = "refunded", "Refunded"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"
        REFUND_PROCESSING = "refund_processing", "Refund Processing"

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
    # Independent package breakdown snapshots
    service_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    service_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    coupon_code = models.CharField(max_length=50, blank=True)
    # For independent packages, we keep trip_type snapshot
    trip_type = models.CharField(max_length=30, blank=True)

    booking_status = models.CharField(
        max_length=30, choices=BookingStatus.choices, default=BookingStatus.PENDING
    )
    payment_status = models.CharField(
        max_length=30, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
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
    govt_id = models.CharField(max_length=100, blank=True, help_text="Government ID / Passport number if required")
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    id_proof = models.FileField(
        upload_to=traveler_id_proof_path, blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "travelers"
        ordering = ["id"]

    def __str__(self):
        return f"{self.full_name} ({self.booking.booking_reference})"


class BookingService(models.Model):
    class ServiceStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="booking_services")
    # Snapshot of PackageService at booking time
    package_service = models.ForeignKey('packages.PackageService', on_delete=models.SET_NULL, null=True, blank=True)
    service_name = models.CharField(max_length=255)
    service_type = models.CharField(max_length=30)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=ServiceStatus.choices, default=ServiceStatus.PENDING)
    notes = models.CharField(max_length=255, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "booking_services"
        ordering = ["id"]

    def __str__(self):
        return f"{self.booking.booking_reference} - {self.service_name} ({self.status})"
