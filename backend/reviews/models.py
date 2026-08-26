from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from bookings.models import Booking
from packages.models import TourPackage


class Review(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    package = models.ForeignKey(TourPackage, on_delete=models.CASCADE, related_name="reviews")
    # One review per booking — also the mechanism that prevents a user
    # from reviewing the same booking twice (see unique=True below).
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")

    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviews"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["package"]),
            models.Index(fields=["rating"]),
        ]

    def __str__(self):
        return f"{self.user.username} rated {self.package.title}: {self.rating}/5"
