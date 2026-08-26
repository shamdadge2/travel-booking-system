from django.urls import path
from . import views

app_name = "itineraries"

urlpatterns = [
    path(
        "packages/<int:package_id>/itinerary/",
        views.package_itinerary_list_create,
        name="package-itinerary-list-create",
    ),
    path(
        "itinerary/<int:itinerary_id>/",
        views.itinerary_detail,
        name="itinerary-detail",
    ),
]
