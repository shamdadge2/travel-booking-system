from django.urls import path
from . import views

app_name = "bookings"

urlpatterns = [
    path("", views.booking_list_create, name="booking-list-create"),
    path("<int:booking_id>/", views.booking_detail, name="booking-detail"),
    path("<int:booking_id>/cancel/", views.cancel_booking, name="booking-cancel"),
    path(
        "travelers/<int:traveler_id>/id-proof/",
        views.upload_traveler_id_proof,
        name="traveler-id-proof-upload",
    ),
]
