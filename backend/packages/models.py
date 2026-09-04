from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify

from destinations.models import Destination


def package_featured_image_path(instance, filename):
    # Stable path without id to avoid 'new' folder on first save (Render ephemeral FS)
    return f"packages/featured/{filename}"


def package_gallery_image_path(instance, filename):
    return f"packages/gallery/{filename}"


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

    class TripType(models.TextChoices):
        GROUP_TOUR = "group_tour", "Group Tour"
        INDEPENDENT_PACKAGE = "independent_package", "Independent Package"

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
    trip_type = models.CharField(
        max_length=30,
        choices=TripType.choices,
        default=TripType.GROUP_TOUR,
        db_index=True,
    )
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

    # Independent package fields
    service_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Company service fee added on top of service costs for independent packages.",
    )
    best_time_to_visit = models.CharField(max_length=255, blank=True, help_text="e.g. 'October to March'")
    category = models.CharField(max_length=100, blank=True, help_text="Optional category for independent packages")

    # Group tour pickup points (big cities as hubs)
    pickup_points = models.ManyToManyField(
        "PickupPoint",
        blank=True,
        related_name="packages",
        help_text="For group tours: pickup hubs where we bring travelers with us.",
    )

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
            models.Index(fields=["trip_type"]),
            models.Index(fields=["is_featured"]),
        ]

    def __str__(self):
        return self.title

    @property
    def effective_price(self):
        """The price a customer actually pays: discount price if set, else regular price.
        For independent packages, if services exist, the dynamic price is used instead.
        """
        if self.trip_type == self.TripType.INDEPENDENT_PACKAGE:
            # If services are defined, compute from services
            try:
                if hasattr(self, 'package_services') and self.package_services.exists():
                    return self.computed_independent_price
            except Exception:
                pass
        if self.discount_price is not None and self.discount_price < self.price:
            return self.discount_price
        return self.price

    @property
    def computed_independent_price(self):
        """Sum of included services + service_fee for independent packages.
        For selectable groups, only the default-selected per group is counted for list price."""
        from decimal import Decimal
        total = Decimal('0')
        # group handling: for selectable groups, only default counts
        selectable_groups = {}
        for ps in self.package_services.filter(is_included=True):
            if ps.is_user_selectable and ps.option_group:
                if ps.option_group not in selectable_groups:
                    # pick default else first
                    group_qs = self.package_services.filter(is_included=True, is_user_selectable=True, option_group=ps.option_group).order_by('-is_default_selected', 'display_order')
                    chosen = group_qs.first()
                    selectable_groups[ps.option_group] = chosen
                continue
            try:
                total += ps.total_price
            except Exception:
                total += (ps.unit_price or Decimal('0')) * (ps.quantity or 1)
        for chosen in selectable_groups.values():
            if chosen:
                try:
                    total += chosen.total_price
                except Exception:
                    total += (chosen.unit_price or Decimal('0')) * (chosen.quantity or 1)
        return total + (self.service_fee or Decimal('0'))

    def compute_price_for_selection(self, selected_ids=None):
        """Compute price for a specific user selection (list of PackageService ids)."""
        from decimal import Decimal
        total = Decimal('0')
        if selected_ids is None:
            return self.computed_independent_price
        selected_set = set(int(x) for x in selected_ids)
        # Determine groups
        groups = {}
        for ps in self.package_services.filter(is_included=True, is_user_selectable=True):
            groups.setdefault(ps.option_group or f"__single_{ps.id}", []).append(ps)
        # Add non-selectable always
        for ps in self.package_services.filter(is_included=True, is_user_selectable=False):
            total += ps.total_price
        # Add selected per group
        for grp, opts in groups.items():
            chosen = None
            for ps in opts:
                if ps.id in selected_set:
                    chosen = ps
                    break
            if not chosen:
                # fallback to default
                for ps in opts:
                    if ps.is_default_selected:
                        chosen = ps
                        break
                if not chosen and opts:
                    chosen = opts[0]
            if chosen:
                total += chosen.total_price
        return total + (self.service_fee or Decimal('0'))

    @property
    def service_cost_total(self):
        from decimal import Decimal
        total = Decimal('0')
        for ps in self.package_services.filter(is_included=True):
            # for list view, use same logic as computed price without groups double count
            # need to avoid double counting selectable groups
            pass
        # reuse selectable logic but without fee
        from decimal import Decimal as D
        # simple sum for display (default)
        total = D('0')
        selectable_groups = {}
        for ps in self.package_services.filter(is_included=True):
            if ps.is_user_selectable and ps.option_group:
                if ps.option_group not in selectable_groups:
                    group_qs = self.package_services.filter(is_included=True, is_user_selectable=True, option_group=ps.option_group).order_by('-is_default_selected', 'display_order')
                    chosen = group_qs.first()
                    selectable_groups[ps.option_group] = chosen
                continue
            total += ps.total_price
        for chosen in selectable_groups.values():
            if chosen:
                total += chosen.total_price
        return total

    @property
    def is_discounted(self):
        return self.discount_price is not None and self.discount_price < self.price

    @property
    def is_independent(self):
        return self.trip_type == self.TripType.INDEPENDENT_PACKAGE

    @property
    def is_group_tour(self):
        return self.trip_type == self.TripType.GROUP_TOUR

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


# ----------------------------------------------------------------
# Independent Package Services
# ----------------------------------------------------------------
class TravelService(models.Model):
    class ServiceType(models.TextChoices):
        TRANSPORTATION = "transportation", "Transportation"
        ACCOMMODATION = "accommodation", "Accommodation"
        GUIDE = "guide", "Guide"
        ACTIVITY = "activity", "Activity"
        SIGHTSEEING = "sightseeing", "Sightseeing"
        MEALS = "meals", "Meals"
        OTHER = "other", "Other"

    class ServiceCategory(models.TextChoices):
        FLIGHT = "flight", "Flight"
        TRAIN = "train", "Train"
        BUS = "bus", "Bus"
        PRIVATE_VEHICLE = "private_vehicle", "Private Vehicle"
        AIRPORT_TRANSFER = "airport_transfer", "Airport Transfer"
        HOTEL = "hotel", "Hotel"
        ROOM_TYPE = "room_type", "Room Type"
        GUIDE_SERVICE = "guide_service", "Guide Service"
        ACTIVITY_SERVICE = "activity_service", "Activity Service"
        ATTRACTION = "attraction", "Attraction"
        MEAL_SERVICE = "meal_service", "Meal Service"
        OTHER = "other", "Other"

    service_type = models.CharField(max_length=30, choices=ServiceType.choices, db_index=True)
    service_category = models.CharField(max_length=30, choices=ServiceCategory.choices, default=ServiceCategory.OTHER)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    # Pricing
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=30, default="per_person", help_text="e.g. per_person, per_night, per_trip")
    # Availability
    is_active = models.BooleanField(default=True)
    max_capacity = models.PositiveIntegerField(null=True, blank=True, help_text="Optional capacity per day")
    # Extra details JSON for flexible fields (guide language, hotel stars, etc.)
    extra_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "travel_services"
        ordering = ["service_type", "name"]
        indexes = [
            models.Index(fields=["service_type"]),
            models.Index(fields=["service_category"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_service_type_display()})"


class PackageService(models.Model):
    package = models.ForeignKey(TourPackage, on_delete=models.CASCADE, related_name="package_services")
    service = models.ForeignKey(TravelService, on_delete=models.PROTECT, related_name="package_usages")
    # Snapshot pricing at time of package creation - can be overridden
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    # is_included determines if counted in total; is_required determines booking block
    is_included = models.BooleanField(default=True)
    is_required = models.BooleanField(default=True, help_text="If required and service unavailable, booking blocked")
    # For user choice: allow traveler to choose among options
    is_user_selectable = models.BooleanField(default=False, help_text="If true, user can choose this option among its group")
    option_group = models.CharField(max_length=50, blank=True, db_index=True, help_text="E.g. 'transport' or 'hotel' - mutually exclusive; only one per group is charged")
    is_default_selected = models.BooleanField(default=False, help_text="If selectable, whether this is pre-selected")
    display_order = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "package_services"
        ordering = ["display_order", "id"]
        indexes = [
            models.Index(fields=["package"]),
        ]

    @property
    def total_price(self):
        from decimal import Decimal
        return (self.unit_price or Decimal('0')) * (self.quantity or 1)

    def __str__(self):
        return f"{self.package.title} - {self.service.name} x{self.quantity}"


class PackageTravelDate(models.Model):
    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "available", "Available"
        LIMITED = "limited", "Limited"
        NOT_AVAILABLE = "not_available", "Not Available"

    package = models.ForeignKey(TourPackage, on_delete=models.CASCADE, related_name="travel_dates")
    travel_date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=AvailabilityStatus.choices, default=AvailabilityStatus.AVAILABLE)
    available_slots = models.PositiveIntegerField(null=True, blank=True, help_text="Overrides package available_slots for this date if set")
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "package_travel_dates"
        ordering = ["travel_date"]
        constraints = [
            models.UniqueConstraint(fields=["package", "travel_date"], name="unique_package_travel_date")
        ]

    def __str__(self):
        return f"{self.package.title} - {self.travel_date} ({self.status})"


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        FIXED = "fixed", "Fixed Amount"
        PERCENT = "percent", "Percentage"

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.FIXED)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    min_booking_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Cap for percent discounts")
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Null = unlimited")
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    # applicable to which trip types
    applicable_trip_type = models.CharField(max_length=30, choices=TourPackage.TripType.choices, blank=True, help_text="Blank = applies to all")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "coupons"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} ({self.discount_type})"

    def is_valid_for_amount(self, amount):
        from django.utils import timezone
        if not self.is_active:
            return False, "Coupon is inactive"
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False, "Coupon not yet valid"
        if self.valid_until and now > self.valid_until:
            return False, "Coupon has expired"
        if self.usage_limit and self.used_count >= self.usage_limit:
            return False, "Coupon usage limit reached"
        if amount < self.min_booking_amount:
            return False, f"Minimum booking amount is {self.min_booking_amount}"
        return True, "Valid"

    def calculate_discount(self, amount):
        from decimal import Decimal
        if self.discount_type == self.DiscountType.FIXED:
            return min(self.discount_value, amount)
        else:
            discount = amount * (self.discount_value / Decimal('100'))
            if self.max_discount:
                discount = min(discount, self.max_discount)
            return min(discount, amount)


class CancellationPolicy(models.Model):
    package = models.OneToOneField(TourPackage, on_delete=models.CASCADE, null=True, blank=True, related_name="cancellation_policy", help_text="Null = global default policy")
    name = models.CharField(max_length=255, default="Standard Cancellation Policy")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cancellation_policies"

    def __str__(self):
        return self.name + (f" ({self.package.title})" if self.package else " (Global)")

    def get_refund_percent(self, days_before):
        rule = self.rules.filter(days_before_min__lte=days_before).order_by('-days_before_min').first()
        # fallback to most restrictive
        if not rule:
            # find rule where days_before is less than min
            rule = self.rules.order_by('days_before_min').first()
            if rule and days_before < rule.days_before_min:
                return 0
        return rule.refund_percent if rule else 0


class CancellationRule(models.Model):
    policy = models.ForeignKey(CancellationPolicy, on_delete=models.CASCADE, related_name="rules")
    days_before_min = models.PositiveIntegerField(help_text="Minimum days before travel for this rule")
    days_before_max = models.PositiveIntegerField(null=True, blank=True, help_text="Max days (null = no upper limit)")
    refund_percent = models.PositiveIntegerField(validators=[MinValueValidator(0)], help_text="0-100")
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "cancellation_rules"
        ordering = ["-days_before_min"]

    def __str__(self):
        max_s = f"-{self.days_before_max}" if self.days_before_max else "+"
        return f"{self.days_before_min}{max_s} days: {self.refund_percent}%"


# ----------------------------------------------------------------
# Pickup Points for Group Tours
# Admin defines big cities / pickup hubs (e.g. Delhi, Mumbai, Pune)
# Each TourPackage (especially group_tour) can have multiple pickup points.
# User location -> nearest pickup point suggestion via haversine.
# ----------------------------------------------------------------
class PickupPoint(models.Model):
    city = models.CharField(max_length=100, db_index=True, help_text="Big city name e.g. Mumbai, Delhi, Pune")
    name = models.CharField(max_length=255, help_text="Specific pickup location e.g. 'Dadar Station', 'Leh Airport'")
    address = models.CharField(max_length=500, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Latitude for distance calculation")
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Longitude for distance calculation")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pickup_points"
        ordering = ["city", "name"]
        indexes = [
            models.Index(fields=["city"]),
            models.Index(fields=["is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["city", "name"], name="unique_pickup_city_name")
        ]

    def __str__(self):
        return f"{self.city} - {self.name}"

    def distance_to(self, lat, lng):
        """Haversine distance in km to given lat/lng. Returns None if coords missing."""
        if self.latitude is None or self.longitude is None or lat is None or lng is None:
            return None
        try:
            import math
            lat1 = math.radians(float(self.latitude))
            lon1 = math.radians(float(self.longitude))
            lat2 = math.radians(float(lat))
            lon2 = math.radians(float(lng))
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            return 6371 * c  # Earth radius km
        except Exception:
            return None
