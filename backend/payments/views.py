from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import is_staff_or_admin
from bookings.models import Booking
from config.pagination import StandardResultsPagination

from .models import Payment, PaymentSettings, generate_transaction_id
from .serializers import (
    PaymentCreateSerializer,
    PaymentProcessSerializer,
    PaymentReferenceSerializer,
    PaymentSerializer,
    PaymentSettingsSerializer,
)


def _can_access_payment(user, payment):
    return bool(user and user.is_authenticated and (user == payment.booking.user or is_staff_or_admin(user)))


# ---------------------------------------------------------------
# GET / POST /api/payments/
# ---------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def payment_list_create(request):
    if request.method == "GET":
        queryset = Payment.objects.select_related("booking", "booking__package", "booking__user")
        if not is_staff_or_admin(request.user):
            queryset = queryset.filter(booking__user=request.user)

        payment_status = request.query_params.get("payment_status")
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PaymentSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    # POST — create a new (pending) payment attempt for a booking
    serializer = PaymentCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    booking = serializer.validated_data["booking"]

    if not (request.user == booking.user or is_staff_or_admin(request.user)):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if booking.payment_status == Booking.PaymentStatus.PAID:
        return Response(
            {"detail": "This booking has already been paid for."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing_pending = Payment.objects.filter(
        booking=booking, payment_status=Payment.PaymentStatus.PENDING
    ).first()
    if existing_pending:
        return Response(
            {
                "detail": "A pending payment already exists for this booking.",
                "payment_id": existing_pending.id,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    payment = Payment.objects.create(
        booking=booking,
        transaction_id=generate_transaction_id(),
        amount=booking.total_amount,
        payment_method=serializer.validated_data["payment_method"],
    )

    return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------
# GET /api/payments/<id>/
# ---------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_payment(request, payment_id):
    payment = get_object_or_404(
        Payment.objects.select_related("booking", "booking__package", "booking__user"),
        id=payment_id,
    )
    if not _can_access_payment(request.user, payment):
        return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

    return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# POST /api/payments/<id>/process/
#
# For "card"/"netbanking" — clearly-labeled instant mock simulations,
# no real money involved — the booking's own owner can trigger this
# directly, same as clicking "Pay" on any demo checkout.
#
# For "upi" — a real upi:// deep link was opened, so real money may
# actually have moved. The customer canNOT self-confirm their own UPI
# payment; only an admin/staff member can mark it paid/failed, after
# manually checking that the money arrived (see reference_number,
# submitted via submit_payment_reference below).
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def process_payment(request, payment_id):
    payment = get_object_or_404(Payment.objects.select_related("booking"), id=payment_id)

    if not _can_access_payment(request.user, payment):
        return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

    if payment.payment_method == Payment.PaymentMethod.UPI and not is_staff_or_admin(request.user):
        return Response(
            {
                "detail": (
                    "UPI payments are verified and confirmed by our team after the "
                    "payment is received. Please submit your transaction reference "
                    "number and we'll confirm your booking shortly."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if payment.payment_status != Payment.PaymentStatus.PENDING:
        return Response(
            {"detail": f"This payment has already been {payment.payment_status} and cannot be reprocessed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = PaymentProcessSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    simulate_result = serializer.validated_data["simulate_result"]

    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(id=payment.booking_id)

        if simulate_result == "success":
            payment.payment_status = Payment.PaymentStatus.PAID
            payment.paid_at = timezone.now()
            payment.save(update_fields=["payment_status", "paid_at", "updated_at"])

            booking.payment_status = Booking.PaymentStatus.PAID
            if booking.booking_status == Booking.BookingStatus.PENDING:
                booking.booking_status = Booking.BookingStatus.CONFIRMED
            booking.save(update_fields=["payment_status", "booking_status", "updated_at"])
        else:
            payment.payment_status = Payment.PaymentStatus.FAILED
            payment.save(update_fields=["payment_status", "updated_at"])

            booking.payment_status = Booking.PaymentStatus.FAILED
            booking.save(update_fields=["payment_status", "updated_at"])

    return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# POST /api/payments/<id>/reference/
#
# The customer's half of UPI verification: after paying in their UPI
# app, they submit the transaction reference/UTR number here. This
# does NOT mark the payment paid — it just records the reference so
# an admin can look it up in their bank/UPI statement and confirm it
# via process_payment above.
# ---------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_payment_reference(request, payment_id):
    payment = get_object_or_404(Payment.objects.select_related("booking"), id=payment_id)

    if not _can_access_payment(request.user, payment):
        return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

    if payment.payment_status != Payment.PaymentStatus.PENDING:
        return Response(
            {"detail": f"This payment has already been {payment.payment_status}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = PaymentReferenceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payment.reference_number = serializer.validated_data["reference_number"]
    payment.save(update_fields=["reference_number", "updated_at"])

    return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------
# GET /api/payments/settings/
#
# Public — the frontend needs this to build a UPI deep link (the
# receiving account + display name) before/without requiring the
# customer to be mid-checkout to see it.
# ---------------------------------------------------------------
@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def payment_settings(request):
    settings_obj = PaymentSettings.get_current()

    if request.method == "GET":
        if settings_obj is None:
            return Response(
                {"detail": "Payment settings have not been configured yet."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PaymentSettingsSerializer(settings_obj).data, status=status.HTTP_200_OK)

    # PUT — admin/staff only. Upserts the singleton settings row so
    # the admin panel can set/change the receiving UPI account without
    # needing Django admin.
    if not (request.user.is_authenticated and is_staff_or_admin(request.user)):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {"detail": "You do not have permission to perform this action."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = PaymentSettingsSerializer(instance=settings_obj, data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_200_OK)
