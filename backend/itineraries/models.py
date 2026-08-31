from django.db import models

from packages.models import TourPackage


class Itinerary(models.Model):
    """
    One day's plan within a tour package's itinerary, e.g.:

        Day 1: Arrival in Leh
        Day 2: Leh to Nubra Valley
        Day 3: Nubra Valley to Pangong Lake
    """

    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="itinerary_days"
    )
    day_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    activities = models.TextField(
        blank=True,
        help_text="Free-text summary of the day's activities.",
    )
    meals = models.CharField(
        max_length=255,
        blank=True,
        help_text='e.g. "Breakfast, Lunch, Dinner"',
    )
    accommodation = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    transportation = models.CharField(max_length=255, blank=True, help_text="e.g. Flight, Private vehicle, Train")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "itineraries"
        ordering = ["package", "day_number"]
        verbose_name = "Itinerary"
        verbose_name_plural = "Itineraries"
        constraints = [
            models.UniqueConstraint(
                fields=["package", "day_number"],
                name="unique_day_number_per_package",
            )
        ]

    def __str__(self):
        return f"{self.package.title} — Day {self.day_number}: {self.title}"
