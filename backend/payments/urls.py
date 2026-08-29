from django.urls import path
from . import views

app_name = "payments"

urlpatterns = [
    path("", views.payment_list_create, name="payment-list-create"),
    path("settings/", views.payment_settings, name="payment-settings"),
    path("create-razorpay-order/", views.create_razorpay_order, name="create-razorpay-order"),
    path("verify-razorpay/", views.verify_razorpay_payment, name="verify-razorpay"),
    path("<int:payment_id>/", views.get_payment, name="payment-detail"),
    path("<int:payment_id>/process/", views.process_payment, name="payment-process"),
    path("<int:payment_id>/reference/", views.submit_payment_reference, name="payment-reference"),
]
