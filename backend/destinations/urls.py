from django.urls import path
from . import views

app_name = "destinations"

urlpatterns = [
    path("", views.get_destinations, name="destination-list"),
    path("create/", views.create_destination, name="destination-create"),
    path("<int:destination_id>/", views.get_destination, name="destination-detail"),
    path("<int:destination_id>/update/", views.update_destination, name="destination-update"),
    path("<int:destination_id>/delete/", views.delete_destination, name="destination-delete"),
]
