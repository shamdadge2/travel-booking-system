from django.contrib import admin

from itineraries.models import Itinerary

from .models import (
    CancellationPolicy,
    Coupon,
    PackageActivity,
    PackageExclusion,
    PackageFAQ,
    PackageImage,
    PackageInclusion,
    PackageService,
    PackageTravelDate,
    TourPackage,
    TravelService,
)


class PackageImageInline(admin.TabularInline):
    model = PackageImage
    extra = 1
    fields = ("image", "place_name", "caption", "display_order")


class PackageInclusionInline(admin.TabularInline):
    model = PackageInclusion
    extra = 1
    fields = ("item",)


class PackageExclusionInline(admin.TabularInline):
    model = PackageExclusion
    extra = 1
    fields = ("item",)


class PackageActivityInline(admin.TabularInline):
    model = PackageActivity
    extra = 1
    fields = ("day_number", "title", "description", "duration")
    ordering = ("day_number",)


class PackageFAQInline(admin.TabularInline):
    model = PackageFAQ
    extra = 1
    fields = ("question", "answer")


class ItineraryInline(admin.TabularInline):
    model = Itinerary
    extra = 1
    fields = ("day_number", "title", "location", "meals", "accommodation", "transportation")
    ordering = ("day_number",)


class PackageServiceInline(admin.TabularInline):
    model = PackageService
    extra = 1
    fields = ("service", "quantity", "unit_price", "is_included", "is_required", "is_user_selectable", "option_group", "is_default_selected", "display_order")
    autocomplete_fields = ("service",)


class PackageTravelDateInline(admin.TabularInline):
    model = PackageTravelDate
    extra = 1
    fields = ("travel_date", "status", "available_slots", "price_override", "notes")


@admin.register(TourPackage)
class TourPackageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "destination",
        "trip_type",
        "package_type",
        "difficulty",
        "price",
        "discount_price",
        "available_slots",
        "max_travelers",
        "status",
        "is_featured",
        "created_at",
    )
    list_display_links = ("id", "title")
    list_editable = ("status", "is_featured")
    list_filter = ("status", "trip_type", "package_type", "difficulty", "is_featured", "destination")
    search_fields = ("title", "short_description", "description", "destination__name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("destination", "created_by")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25

    fieldsets = (
        (None, {"fields": ("title", "slug", "destination", "trip_type", "status", "is_featured")}),
        ("Description", {"fields": ("short_description", "description")}),
        ("Duration & Dates", {"fields": ("duration_days", "duration_nights", "start_date", "end_date", "pickup_location", "best_time_to_visit", "category")}),
        ("Pricing & Capacity", {"fields": ("price", "discount_price", "service_fee", "max_travelers", "available_slots")}),
        ("Classification", {"fields": ("package_type", "difficulty", "featured_image")}),
        ("Ownership", {"fields": ("created_by",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    inlines = [
        PackageImageInline,
        PackageServiceInline,
        PackageTravelDateInline,
        PackageInclusionInline,
        PackageExclusionInline,
        PackageActivityInline,
        PackageFAQInline,
        ItineraryInline,
    ]


@admin.register(TravelService)
class TravelServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "service_type", "service_category", "price", "unit", "is_active")
    list_filter = ("service_type", "service_category", "is_active")
    search_fields = ("name", "description", "location")
    list_editable = ("is_active", "price")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "discount_value", "is_active", "valid_from", "valid_until", "used_count")
    list_filter = ("discount_type", "is_active")
    search_fields = ("code",)


@admin.register(PackageTravelDate)
class PackageTravelDateAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "travel_date", "status", "available_slots")
    list_filter = ("status",)
