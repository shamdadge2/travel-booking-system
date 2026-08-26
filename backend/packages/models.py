from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify

from destinations.models import Destination


def package_featured_image_path(instance, filename):
    return f"packages/{instance.id or 'new'}/featured/{filename}"


def package_gallery_image_path(instance, filename):
    return f"packages/{instance.package_id}/gallery/{filename}"


class TourPackage(models.Model):
    class PackageType(models.TextChoices):
        ADVENTURE = "adventure", "Adventure"
        HONEYMOON = "honeymoon", "Honeymoon"
        FAMILY = "family", "Family"
        PILGRIMAGE = "pilgrimage", "Pilgrimage"
        WILDLIFE = "wildlife", "Wildlife"
        BEACH = "beach", "Beach"
        CULTURAL = "cultural", "Cultural"
        LUXURY = "luxury", "Luxury"

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MODERATE = "moderate", "Moderate"
        DIFFICULT = "difficult", "Difficult"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        INACTIVE = "inactive", "Inactive"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    destination = models.ForeignKey(
        Destination,
        on_delete=models.PROTECT,
        related_name="packages",
    )
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)

    duration_days = models.PositiveIntegerField()
    duration_nights = models.PositiveIntegerField()

    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    discount_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )

    max_travelers = models.PositiveIntegerField()
    available_slots = models.PositiveIntegerField()

    package_type = models.CharField(max_length=20, choices=PackageType.choices)
    difficulty = models.CharField(
        max_length=20, choices=Difficulty.choices, default=Difficulty.EASY
    )

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    pickup_location = models.CharField(
        max_length=255,
        blank=True,
        help_text="Where travelers will be picked up from, e.g. 'Leh Airport' or 'Hotel lobby, Panaji'.",
    )

    featured_image = models.ImageField(
        upload_to=package_featured_image_path, blank=True, null=True
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    # Toggle for surfacing a package on the homepage / featured listing.
    is_featured = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_packages",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tour_packages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["package_type"]),
            models.Index(fields=["is_featured"]),
        ]

    def __str__(self):
        return self.title

    @property
    def effective_price(self):
        """The price a customer actually pays: discount price if set, else regular price."""
        if self.discount_price is not None and self.discount_price < self.price:
            return self.discount_price
        return self.price

    @property
    def is_discounted(self):
        return self.discount_price is not None and self.discount_price < self.price

    def _generate_unique_slug(self):
        base_slug = slugify(self.title)[:250] or "package"
        slug = base_slug
        counter = 2
        while (
            TourPackage.objects.filter(slug=slug).exclude(pk=self.pk).exists()
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)


class PackageImage(models.Model):
    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to=package_gallery_image_path)
    place_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the place shown in this photo, e.g. 'Nubra Valley'.",
    )
    caption = models.CharField(
        max_length=255,
        blank=True,
        help_text="Short description of the place/photo.",
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "package_images"
        ordering = ["display_order", "id"]

    def __str__(self):
        label = self.place_name or f"#{self.display_order}"
        return f"Image for {self.package.title} ({label})"


class PackageInclusion(models.Model):
    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="inclusions"
    )
    item = models.CharField(max_length=255)

    class Meta:
        db_table = "package_inclusions"
        ordering = ["id"]

    def __str__(self):
        return self.item


class PackageExclusion(models.Model):
    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="exclusions"
    )
    item = models.CharField(max_length=255)

    class Meta:
        db_table = "package_exclusions"
        ordering = ["id"]

    def __str__(self):
        return self.item


class PackageActivity(models.Model):
    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="activities"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    day_number = models.PositiveIntegerField()
    duration = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "package_activities"
        ordering = ["day_number", "id"]
        verbose_name = "Package Activity"
        verbose_name_plural = "Package Activities"

    def __str__(self):
        return f"Day {self.day_number}: {self.title}"


class PackageFAQ(models.Model):
    package = models.ForeignKey(
        TourPackage, on_delete=models.CASCADE, related_name="faqs"
    )
    question = models.CharField(max_length=500)
    answer = models.TextField()

    class Meta:
        db_table = "package_faqs"
        ordering = ["id"]

    def __str__(self):
        return self.question
