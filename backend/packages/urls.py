from django.urls import path
from . import views

app_name = "packages"

urlpatterns = [
    path("", views.get_packages, name="package-list"),
    path("create/", views.create_package, name="package-create"),
    path("featured/", views.featured_packages, name="package-featured"),
    path("search/", views.search_packages, name="package-search"),

    path("images/<int:image_id>/delete/", views.delete_package_image, name="package-image-delete"),

    path("<int:package_id>/", views.get_package, name="package-detail"),
    path("<int:package_id>/update/", views.update_package, name="package-update"),
    path("<int:package_id>/delete/", views.delete_package, name="package-delete"),
    path("<int:package_id>/availability/", views.package_availability, name="package-availability"),
    path("<int:package_id>/images/add/", views.add_package_image, name="package-image-add"),
]
