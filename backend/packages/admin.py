from django.contrib import admin

from itineraries.models import Itinerary

from .models import (
    PackageActivity,
    PackageExclusion,
    PackageFAQ,
    PackageImage,
    PackageInclusion,
    TourPackage,
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
    fields = ("day_number", "title", "location", "meals", "accommodation")
    ordering = ("day_number",)


@admin.register(TourPackage)
class TourPackageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "destination",
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
    list_filter = ("status", "package_type", "difficulty", "is_featured", "destination")
    search_fields = ("title", "short_description", "description", "destination__name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("destination", "created_by")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25

    fieldsets = (
        (None, {"fields": ("title", "slug", "destination", "status", "is_featured")}),
        ("Description", {"fields": ("short_description", "description")}),
        ("Duration & Dates", {"fields": ("duration_days", "duration_nights", "start_date", "end_date", "pickup_location")}),
        ("Pricing & Capacity", {"fields": ("price", "discount_price", "max_travelers", "available_slots")}),
        ("Classification", {"fields": ("package_type", "difficulty", "featured_image")}),
        ("Ownership", {"fields": ("created_by",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    inlines = [
        PackageImageInline,
        PackageInclusionInline,
        PackageExclusionInline,
        PackageActivityInline,
        PackageFAQInline,
        ItineraryInline,
    ]
