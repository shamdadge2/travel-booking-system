from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed


class SingleSessionJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to enforce single-device login for admin/staff.
    Tokens carry `session_version`; if the token's version does not match
    the user's current `session_version`, the token is from a previous
    device and is rejected as expired (logged in elsewhere).
    Normal customers (role=customer, not staff/superuser) are unaffected.
    """

    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)

        # Only enforce for admin/staff users
        try:
            user_id = validated_token.get("user_id")
            token_version = validated_token.get("session_version")
            if user_id is None:
                return validated_token

            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise InvalidToken("User not found")

            is_admin_session = (
                getattr(user, "is_admin_role", False)
                or getattr(user, "is_staff_role", False)
                or user.is_staff
                or user.is_superuser
                or getattr(user, "role", None) in ("admin", "staff")
            )
            if not is_admin_session:
                return validated_token

            # For admin, session_version must match
            # Old tokens without claim are treated as version 0
            current = int(getattr(user, "session_version", 0) or 0)
            token_v = token_version
            if token_v is None:
                # No claim -> old token
                if current != 0:
                    raise InvalidToken("Session expired — logged in elsewhere (01)")
                return validated_token
            try:
                token_int = int(token_v)
            except (ValueError, TypeError):
                raise InvalidToken("Invalid session")

            if token_int != current:
                raise InvalidToken("Session expired — logged in elsewhere")

        except InvalidToken:
            raise
        except AuthenticationFailed:
            raise
        except Exception:
            # Don't block on unexpected errors in version check; let token through
            # (fail open) to avoid breaking all auth if DB unavailable.
            # In production, you may want to fail closed instead.
            pass

        return validated_token
