from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Read/update serializer for the currently authenticated user's own
    profile. `role`, `is_active`, and `username` are read-only here —
    a normal user must not be able to grant themselves admin rights,
    deactivate their own account, or change their login username.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile_image",
            "role",
            "is_active",
            "date_joined",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "username",
            "role",
            "is_active",
            "date_joined",
            "created_at",
            "updated_at",
        ]

    def validate_email(self, value):
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This email is already in use.")
        return value


class RegisterSerializer(serializers.ModelSerializer):
    """
    Handles new account creation. `role` is intentionally NOT accepted
    from the client — every self-registered account is created as a
    "customer". Staff/admin accounts are promoted later via the admin
    user-management endpoints or Django admin, never at signup time.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "password2",
            "first_name",
            "last_name",
            "phone",
        ]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password2": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(
            role=User.Role.CUSTOMER,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """
    Accepts either a username or an email address in the `username`
    field, plus a password. Does not touch the database directly —
    resolution/authentication happens in the view.
    """

    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class GoogleLoginSerializer(serializers.Serializer):
    """
    The frontend sends the raw ID token string it got back from
    Google Identity Services. Verification of that token (confirming
    Google actually issued it, for this app, and it hasn't expired)
    happens in the view — this serializer just validates the shape.
    """

    id_token = serializers.CharField(required=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
    )
    new_password2 = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password2": "New password fields didn't match."}
            )
        return attrs


class AdminUserSerializer(serializers.ModelSerializer):
    """
    Used by admin/staff endpoints that manage other users. Unlike
    UserSerializer, this exposes `role` and `is_active` as writable so
    admins can promote/demote users and activate/deactivate accounts.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile_image",
            "role",
            "is_active",
            "date_joined",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "date_joined", "created_at", "updated_at"]
