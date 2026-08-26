from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Extends Django's built-in UserAdmin with the extra fields our
    custom User model adds (phone, profile_image, role, timestamps).
    """

    list_display = (
        "id",
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
        "created_at",
    )
    list_display_links = ("username",)
    list_editable = ("role", "is_active")
    list_filter = ("role", "is_active", "is_staff", "is_superuser", "created_at")
    search_fields = ("username", "email", "first_name", "last_name", "phone")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at", "last_login", "date_joined")

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Travel Booking Profile",
            {
                "fields": (
                    "phone",
                    "profile_image",
                    "role",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Travel Booking Profile",
            {
                "fields": (
                    "email",
                    "phone",
                    "role",
                )
            },
        ),
    )
