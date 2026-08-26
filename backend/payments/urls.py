from django.urls import path
from . import views

app_name = "payments"

urlpatterns = [
    path("", views.payment_list_create, name="payment-list-create"),
    path("settings/", views.payment_settings, name="payment-settings"),
    path("<int:payment_id>/", views.get_payment, name="payment-detail"),
    path("<int:payment_id>/process/", views.process_payment, name="payment-process"),
    path("<int:payment_id>/reference/", views.submit_payment_reference, name="payment-reference"),
]
