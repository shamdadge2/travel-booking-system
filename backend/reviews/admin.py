from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = ("package__title", "user__username", "comment")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("user", "package", "booking")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25
