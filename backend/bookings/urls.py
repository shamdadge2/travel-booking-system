from django.urls import path
from . import views

app_name = "bookings"

urlpatterns = [
    path("stats/", views.booking_stats, name="booking-stats"),
    path("", views.booking_list_create, name="booking-list-create"),
    path("<int:booking_id>/", views.booking_detail, name="booking-detail"),
    path("<int:booking_id>/cancel/", views.cancel_booking, name="booking-cancel"),
    path("<int:booking_id>/invoice/", views.booking_invoice, name="booking-invoice"),
    path("<int:booking_id>/services/<int:service_id>/", views.booking_service_update, name="booking-service-update"),
    path(
        "travelers/<int:traveler_id>/id-proof/",
        views.upload_traveler_id_proof,
        name="traveler-id-proof-upload",
    ),
]
