from django.urls import path
from . import views

app_name = "contact"

urlpatterns = [
    path("", views.create_contact_message, name="contact-create"),
    path("messages/", views.admin_list_messages, name="contact-message-list"),
    path("messages/<int:message_id>/", views.admin_message_detail, name="contact-message-detail"),
]
