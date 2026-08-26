from django.contrib import admin

from .models import Payment, PaymentSettings


@admin.register(PaymentSettings)
class PaymentSettingsAdmin(admin.ModelAdmin):
    list_display = ("upi_id", "merchant_name", "updated_at")
    readonly_fields = ("updated_at",)

    def has_add_permission(self, request):
        # Keep this a true singleton — only one settings row should
        # ever exist, edited in place rather than duplicated.
        return not PaymentSettings.objects.exists()


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_id",
        "booking",
        "amount",
        "payment_method",
        "reference_number",
        "payment_status",
        "paid_at",
        "created_at",
    )
    list_display_links = ("transaction_id",)
    list_filter = ("payment_status", "payment_method", "created_at")
    search_fields = ("transaction_id", "reference_number", "booking__booking_reference", "booking__user__username")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("booking",)
    readonly_fields = ("transaction_id", "amount", "paid_at", "created_at", "updated_at")
    list_per_page = 25
