from django.contrib import admin

from .models import Booking, Traveler


class TravelerInline(admin.TabularInline):
    model = Traveler
    extra = 0
    fields = ("full_name", "age", "gender", "phone", "email", "nationality", "id_proof")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "booking_reference",
        "user",
        "package",
        "travel_date",
        "number_of_travelers",
        "total_amount",
        "booking_status",
        "payment_status",
        "created_at",
    )
    list_display_links = ("booking_reference",)
    list_editable = ("booking_status", "payment_status")
    list_filter = ("booking_status", "payment_status", "created_at")
    search_fields = ("booking_reference", "user__username", "user__email", "package__title")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("user", "package")
    readonly_fields = ("booking_reference", "total_amount", "created_at", "updated_at")
    list_per_page = 25

    fieldsets = (
        (None, {"fields": ("booking_reference", "user", "package")}),
        ("Trip", {"fields": ("travel_date", "number_of_travelers", "special_requests")}),
        ("Financial", {"fields": ("total_amount",)}),
        ("Status", {"fields": ("booking_status", "payment_status")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    inlines = [TravelerInline]


@admin.register(Traveler)
class TravelerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "booking", "age", "gender", "nationality", "created_at")
    list_filter = ("gender",)
    search_fields = ("full_name", "booking__booking_reference", "email", "phone")
    ordering = ("-created_at",)
    autocomplete_fields = ("booking",)
    readonly_fields = ("created_at",)
