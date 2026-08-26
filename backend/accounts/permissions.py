from rest_framework.permissions import BasePermission, SAFE_METHODS


def is_staff_or_admin(user):
    """
    Plain function version of the staff/admin check, for views that
    need to apply different permissions to different HTTP methods
    within the same @api_view function (where a single declarative
    permission_classes list can't express "GET is public, POST isn't").
    """
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.is_staff or getattr(user, "is_staff_role", False))
    )


class IsAdminOrStaffRole(BasePermission):
    """
    Allows access only to authenticated users whose `role` is
    "admin" or "staff" (or Django superusers/staff flags), regardless
    of HTTP method.

    We check the custom `role` field rather than relying purely on
    Django's built-in `is_staff` flag, since this project models
    roles explicitly (customer / staff / admin).
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(
            user.is_superuser
            or user.is_staff
            or getattr(user, "is_staff_role", False)
        )


class IsAdminRole(BasePermission):
    """
    Allows access only to authenticated users whose `role` is "admin"
    (or Django superusers).
    """

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(user.is_superuser or getattr(user, "is_admin_role", False))


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: allows access if the requesting user owns
    the object (object.user == request.user, or the object itself is
    the requesting user) OR the requester is admin/staff.

    Safe (read-only) methods are still restricted to owner/admin —
    override in a view if a wider read audience is required.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if user.is_superuser or getattr(user, "is_staff_role", False):
            return True

        owner = getattr(obj, "user", obj)
        return owner == user
