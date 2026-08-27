"""
Root URL configuration for the Travel Package Booking System.

Each app owns its own urls.py; this file only wires prefixes to apps.
Business logic must never live here.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Travel Booking System Administration"
admin.site.site_title = "Travel Booking Admin"
admin.site.index_title = "Manage destinations, packages, bookings, payments & reviews"

from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        "message": "Welcome to the Travel Booking System API!",
        "status": "active"
    })

urlpatterns = [
    path("", api_root_view, name="api-root"),
    path("admin/", admin.site.urls),

    # Auth / user management (accounts app)
    path("api/auth/", include("accounts.urls")),

    # Public catalog
    path("api/destinations/", include("destinations.urls")),
    path("api/packages/", include("packages.urls")),

    # Nested under packages, but implemented as its own app
    path("api/", include("itineraries.urls")),

    # Transactional apps
    path("api/bookings/", include("bookings.urls")),
    path("api/payments/", include("payments.urls")),

    # Reviews (nested under packages + its own detail routes)
    path("api/", include("reviews.urls")),

    # Contact Us messages
    path("api/contact/", include("contact.urls")),
]

# Serve uploaded media even in production (Render free has ephemeral FS but fine for demo)
# DEBUG check removed because DEBUG=False on Render would otherwise 404 all /media/ image requests
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
