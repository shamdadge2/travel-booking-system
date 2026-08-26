from django.contrib import admin

from .models import Itinerary


@admin.register(Itinerary)
class ItineraryAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "day_number", "title", "location", "created_at")
    list_filter = ("package",)
    search_fields = ("title", "description", "activities", "location", "package__title")
    ordering = ("package", "day_number")
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("package",)
    list_per_page = 25
