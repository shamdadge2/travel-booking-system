from django.urls import path
from . import views

app_name = "packages"

urlpatterns = [
    path("", views.get_packages, name="package-list"),
    path("create/", views.create_package, name="package-create"),
    path("featured/", views.featured_packages, name="package-featured"),
    path("search/", views.search_packages, name="package-search"),

    # Travel services (catalog)
    path("services/", views.travel_service_list_create, name="travel-service-list-create"),
    path("services/<int:service_id>/", views.travel_service_detail, name="travel-service-detail"),

    # Coupons
    path("coupons/", views.coupon_list_create, name="coupon-list-create"),
    path("coupons/<int:coupon_id>/", views.coupon_detail, name="coupon-detail"),
    path("coupons/validate/", views.validate_coupon, name="coupon-validate"),
    path("validate-coupon/", views.validate_coupon, name="validate-coupon-alt"),

    path("images/<int:image_id>/delete/", views.delete_package_image, name="package-image-delete"),

    # Pickup points (big cities as hubs for group tours)
    path("pickup-points/", views.pickup_point_list_create, name="pickup-point-list-create"),
    path("pickup-points/<int:point_id>/", views.pickup_point_detail, name="pickup-point-detail"),
    path("pickup-points/nearest/", views.nearest_pickup_point, name="pickup-point-nearest"),
    path("<int:package_id>/pickup-points/", views.package_pickup_points, name="package-pickup-points"),
    path("<int:package_id>/pickup-points/assign/", views.package_pickup_point_assign, name="package-pickup-points-assign"),

    path("<int:package_id>/", views.get_package, name="package-detail"),
    path("<int:package_id>/update/", views.update_package, name="package-update"),
    path("<int:package_id>/delete/", views.delete_package, name="package-delete"),
    path("<int:package_id>/availability/", views.package_availability, name="package-availability"),
    path("<int:package_id>/images/add/", views.add_package_image, name="package-image-add"),

    # Package services / price / dates
    path("<int:package_id>/services/", views.package_services_list, name="package-services-list"),
    path("<int:package_id>/services/add/", views.package_service_add, name="package-service-add"),
    path("<int:package_id>/services/reorder/", views.package_service_reorder, name="package-service-reorder"),
    path("<int:package_id>/price/calculate/", views.package_price_calculate, name="package-price-calculate"),
    path("<int:package_id>/calculate-price/", views.package_price_calculate, name="package-calculate-price-alt"),
    path("<int:package_id>/travel-dates/", views.package_travel_dates, name="package-travel-dates"),
    path("package-services/<int:ps_id>/", views.package_service_detail, name="package-service-detail"),
    path("travel-dates/<int:date_id>/", views.package_travel_date_detail, name="package-travel-date-detail"),
]
