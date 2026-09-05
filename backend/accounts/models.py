from django.contrib.auth.models import AbstractUser
from django.db import models


def profile_image_upload_path(instance, filename):
    return f"profile_images/user_{instance.id}/{filename}"


class User(AbstractUser):
    """
    Custom user model for the Travel Package Booking System.

    Extends Django's AbstractUser (so we keep username, password,
    first_name, last_name, is_active, is_staff, is_superuser,
    date_joined, last_login for free) and adds the domain-specific
    fields required by the project spec.
    """

    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        STAFF = "staff", "Staff"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_image = models.ImageField(
        upload_to=profile_image_upload_path,
        blank=True,
        null=True,
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )
    # For single-device admin sessions: incremented on each admin login.
    # Tokens carry `session_version`; mismatch => logged in elsewhere.
    session_version = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN

    @property
    def is_staff_role(self):
        return self.role in (self.Role.ADMIN, self.Role.STAFF)
