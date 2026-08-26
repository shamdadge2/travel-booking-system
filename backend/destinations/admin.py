from django.contrib import admin

from .models import Destination


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "city",
        "state",
        "country",
        "is_active",
        "created_at",
    )
    list_display_links = ("id", "name")
    list_editable = ("is_active",)
    list_filter = ("is_active", "country", "state")
    search_fields = ("name", "city", "state", "country", "description")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25

    fieldsets = (
        (None, {"fields": ("name", "description", "image", "is_active")}),
        ("Location", {"fields": ("country", "state", "city", "latitude", "longitude")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
