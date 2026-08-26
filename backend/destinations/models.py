from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def destination_image_upload_path(instance, filename):
    return f"destinations/{instance.id or 'new'}/{filename}"


class Destination(models.Model):
    name = models.CharField(max_length=255)
    country = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    image = models.ImageField(
        upload_to=destination_image_upload_path,
        blank=True,
        null=True,
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "destinations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["country"]),
            models.Index(fields=["city"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        location = ", ".join(filter(None, [self.city, self.state, self.country]))
        return f"{self.name} ({location})"
