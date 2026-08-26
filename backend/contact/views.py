from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaffRole
from config.pagination import StandardResultsPagination

from .models import ContactMessage
from .serializers import ContactMessageCreateSerializer, ContactMessageSerializer


# ---------------------------------------------------------------
# POST /api/contact/
#
# Public — anyone can submit the Contact Us form, no login required.
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def create_contact_message(request):
    serializer = ContactMessageCreateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(
            {"detail": "Thanks for reaching out — we'll get back to you shortly."},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------
# GET /api/contact/messages/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def admin_list_messages(request):
    queryset = ContactMessage.objects.all()

    is_read = request.query_params.get("is_read")
    if is_read is not None:
        queryset = queryset.filter(is_read=is_read.lower() in ("1", "true", "yes"))

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = ContactMessageSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------
# PATCH / DELETE /api/contact/messages/<id>/
# ---------------------------------------------------------------
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaffRole])
def admin_message_detail(request, message_id):
    message = get_object_or_404(ContactMessage, id=message_id)

    if request.method == "DELETE":
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ContactMessageSerializer(message, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
