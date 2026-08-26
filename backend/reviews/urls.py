from django.urls import path
from . import views

app_name = "reviews"

urlpatterns = [
    path(
        "packages/<int:package_id>/reviews/",
        views.package_review_list_create,
        name="package-review-list-create",
    ),
    path("reviews/<int:review_id>/", views.review_detail, name="review-detail"),
]
