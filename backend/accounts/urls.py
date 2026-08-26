from django.urls import path
from . import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.register_user, name="register"),
    path("login/", views.login_user, name="login"),
    path("google/", views.google_login, name="google-login"),
    path("refresh/", views.refresh_token_view, name="refresh"),
    path("logout/", views.logout_user, name="logout"),

    path("profile/", views.profile_view, name="profile"),
    path("change-password/", views.change_password, name="change-password"),

    # Admin / staff user management
    path("users/", views.admin_list_users, name="admin-user-list"),
    path("users/<int:user_id>/", views.admin_user_detail, name="admin-user-detail"),
]
