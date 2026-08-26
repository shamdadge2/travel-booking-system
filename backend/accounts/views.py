from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsAdminOrStaffRole
from .serializers import (
    AdminUserSerializer,
    ChangePasswordSerializer,
    GoogleLoginSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


def _tokens_for_user(user):
    """
    Build an access/refresh token pair for `user`, embedding a few
    useful custom claims (role, username, email) directly on both
    tokens so the frontend can read them without an extra API call.
    """
    refresh = RefreshToken.for_user(user)
    refresh["username"] = user.username
    refresh["email"] = user.email
    refresh["role"] = user.role

    access = refresh.access_token
    access["username"] = user.username
    access["email"] = user.email
    access["role"] = user.role

    return {
        "access": str(access),
        "refresh": str(refresh),
    }


# ---------------------------------------------------------------
# POST /api/auth/register/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        try:
            user = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "A user with this username or email already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        tokens = _tokens_for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# POST /api/auth/login/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    identifier = serializer.validated_data["username"]
    password = serializer.validated_data["password"]

    # Allow logging in with either username or email in the same field.
    username_to_check = identifier
    if "@" in identifier:
        matched_user = User.objects.filter(email__iexact=identifier).first()
        if matched_user:
            username_to_check = matched_user.username

    user = authenticate(request, username=username_to_check, password=password)

    if user is None:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"detail": "This account has been deactivated."},
            status=status.HTTP_403_FORBIDDEN,
        )

    tokens = _tokens_for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": tokens,
        },
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------
# POST /api/auth/google/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    serializer = GoogleLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not settings.GOOGLE_CLIENT_ID:
        return Response(
            {"detail": "Google sign-in is not configured on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        # This call does the actual work of trusting Google: it checks
        # the token's signature against Google's public keys, that it
        # was issued for our GOOGLE_CLIENT_ID specifically (not some
        # other app), and that it hasn't expired. Never trust the
        # email/name inside a token we haven't verified this way.
        claims = google_id_token.verify_oauth2_token(
            serializer.validated_data["id_token"],
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        # Malformed token, wrong audience, expired, bad signature, etc.
        return Response(
            {"detail": "Invalid or expired Google sign-in token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    except google_exceptions.GoogleAuthError:
        # Genuinely couldn't reach Google's servers to verify the token
        # (network hiccup, Google outage) — this is a "try again"
        # situation, not "your credentials are wrong", so it gets its
        # own status code rather than being lumped in with a 401.
        return Response(
            {"detail": "Couldn't verify your Google sign-in right now. Please try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    email = claims.get("email")
    if not email:
        return Response(
            {"detail": "Google account has no email address to sign in with."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not claims.get("email_verified", False):
        return Response(
            {"detail": "Please verify your email address with Google first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.filter(email__iexact=email).first()

    if user is None:
        # First time signing in with this Google account — create a
        # normal customer account. No password is set, since this
        # account only ever logs in via Google.
        base_username = email.split("@")[0]
        username = base_username
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        user = User(
            username=username,
            email=email,
            first_name=claims.get("given_name", ""),
            last_name=claims.get("family_name", ""),
            role=User.Role.CUSTOMER,
        )
        user.set_unusable_password()
        user.save()
    elif not user.is_active:
        return Response(
            {"detail": "This account has been deactivated."},
            status=status.HTTP_403_FORBIDDEN,
        )

    tokens = _tokens_for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": tokens,
        },
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------
# POST /api/auth/refresh/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token_view(request):
    serializer = TokenRefreshSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
    except TokenError:
        return Response(
            {"detail": "Refresh token is invalid or expired."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    except Exception:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    return Response(serializer.validated_data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# POST /api/auth/logout/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response(
            {"detail": "Refresh token is required to logout."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response(
            {"detail": "Refresh token is invalid or already blacklisted."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Successfully logged out."},
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------
# GET / PUT / PATCH /api/auth/profile/
# ---------------------------------------------------------------
@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def profile_view(request):
    user = request.user

    if request.method == "GET":
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    partial = request.method == "PATCH"
    serializer = UserSerializer(user, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# POST /api/auth/change-password/
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(serializer.validated_data["old_password"]):
        return Response(
            {"old_password": "Old password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(serializer.validated_data["new_password"])
    user.save(update_fields=["password"])

    return Response(
        {"detail": "Password changed successfully. Please log in again."},
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------
# GET /api/auth/users/               (admin: list all users)
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def admin_list_users(request):
    users = User.objects.all()

    role = request.query_params.get("role")
    if role:
        users = users.filter(role=role)

    search = request.query_params.get("search")
    if search:
        users = users.filter(username__icontains=search) | users.filter(
            email__icontains=search
        )

    is_active = request.query_params.get("is_active")
    if is_active is not None:
        users = users.filter(is_active=is_active.lower() in ("1", "true", "yes"))

    serializer = AdminUserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# GET / PATCH / DELETE /api/auth/users/<id>/   (admin: manage one user)
# ---------------------------------------------------------------
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def admin_user_detail(request, user_id):
    target_user = get_object_or_404(User, id=user_id)

    if request.method == "GET":
        serializer = AdminUserSerializer(target_user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method == "PATCH":
        # Only a full admin (not plain staff) may change roles or
        # promote/demote another user to prevent staff-on-staff abuse.
        if "role" in request.data and not (
            request.user.is_superuser or request.user.is_admin_role
        ):
            return Response(
                {"detail": "Only administrators can change a user's role."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = AdminUserSerializer(target_user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    if not (request.user.is_superuser or request.user.is_admin_role):
        return Response(
            {"detail": "Only administrators can delete users."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if target_user.id == request.user.id:
        return Response(
            {"detail": "You cannot delete your own account."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        target_user.delete()
    except ProtectedError:
        booking_count = target_user.bookings.count()
        return Response(
            {
                "detail": (
                    f"Cannot delete '{target_user.username}' — they have "
                    f"{booking_count} booking(s) on record. Deactivate the "
                    "account instead (set is_active=false) to preserve booking history."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)
