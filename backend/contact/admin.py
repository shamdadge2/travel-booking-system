from django.contrib import admin

from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "is_read", "created_at")
    list_display_links = ("name",)
    list_editable = ("is_read",)
    list_filter = ("is_read", "created_at")
    search_fields = ("name", "email", "message")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("name", "email", "message", "created_at")
    list_per_page = 25
