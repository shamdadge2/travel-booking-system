import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import paymentApi from "../../api/paymentApi";
import useAuth from "../../hooks/useAuth";
import "./Payment.css";

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [paidPayment, setPaidPayment] = useState(null);

  useEffect(() => {
    bookingApi
      .get(id)
      .then((data) => setBooking(data))
      .catch(() => setLoadError("Couldn't load this booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleRazorpayPay = async () => {
    setError("");
    setProcessing(true);
    try {
      await loadRazorpayScript();

      const orderData = await paymentApi.createRazorpayOrder({ booking: booking.id });

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Travel Booking System",
        description: `Booking ${booking.booking_reference} - ${booking.package.title}`,
        order_id: orderData.razorpay_order_id,
        prefill: {
          name: user?.username || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        notes: {
          booking_id: String(booking.id),
          booking_reference: booking.booking_reference,
        },
        theme: { color: "#0fb5a2" },
        handler: async function (response) {
          try {
            const verified = await paymentApi.verifyRazorpay({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaidPayment(verified);
          } catch (verifyErr) {
            setError(verifyErr.response?.data?.detail || "Payment verification failed. Contact support with payment ID: " + response.razorpay_payment_id);
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setError(resp.error?.description || "Payment failed. Please try again.");
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Couldn't start Razorpay payment. Check if Razorpay is configured on server.";
      setError(msg);
      setProcessing(false);
    }
  };

  if (isLoading) return <Loader label="Loading booking..." />;

  if (loadError || !booking) {
    return (
      <div className="container payment-page">
        <EmptyState tone="error" title="Can't load payment" message={loadError} />
      </div>
    );
  }

  if (paidPayment) {
    return (
      <div className="container payment-page">
        <div className="card payment-page__result payment-page__result--success">
          <h2>Payment Confirmed</h2>
          <p>
            Your booking {booking.booking_reference} has been confirmed and paid.
            Transaction: {paidPayment.transaction_id} {paidPayment.razorpay_payment_id && `· Razorpay: ${paidPayment.razorpay_payment_id}`}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(`/my-bookings/${id}`)}>
            View Booking
          </button>
        </div>
      </div>
    );
  }

  if (booking.payment_status === "paid") {
    return (
      <div className="container payment-page">
        <EmptyState
          title="Already paid"
          message="This booking has already been paid for."
          actionLabel="View Booking"
          onAction={() => navigate(`/my-bookings/${id}`)}
        />
      </div>
    );
  }

  return (
    <div className="container payment-page">
      <div className="page-header">
        <h1>Payment</h1>
        <p>
          <Link to={`/my-bookings/${id}`}>&larr; Back to booking</Link> &middot; Booking {booking.booking_reference} &middot; {booking.package.title}
        </p>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="payment-page__grid">
        <div className="card payment-page__form">
          <h3>Secure Payment via Razorpay</h3>
          <p className="payment-page__mock-note" style={{ marginBottom: 14 }}>
            Pay securely with UPI, Cards, Net Banking, Wallets via Razorpay. Test Mode is FREE — use test card <code>4111 1111 1111 1111</code> or UPI <code>success@razorpay</code>.
          </p>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: "0.82rem", fontWeight: 700 }}>Razorpay Secure</span>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>UPI • Card • NetBanking • Wallet</span>
            </div>
            <p style={{ fontSize: "0.84rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
              You will be redirected to Razorpay's secure checkout to complete payment of <strong>{formatCurrency(booking.total_amount)}</strong>.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleRazorpayPay}
            disabled={processing}
            style={{ minHeight: 48, fontSize: "1rem" }}
          >
            {processing ? "Opening Razorpay..." : `Pay ${formatCurrency(booking.total_amount)} with Razorpay`}
          </button>

          <p className="payment-page__mock-note" style={{ textAlign: "center", marginTop: 10, fontSize: "0.78rem" }}>
            256-bit SSL • RBI compliant • No card details stored on our servers
          </p>
        </div>

        <aside className="card payment-page__summary">
          <h3>Order Summary</h3>
          <div className="payment-page__summary-row">
            <span>{booking.package.title}</span>
            <span>{formatCurrency(booking.total_amount)}</span>
          </div>
          <div className="payment-page__summary-row" style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
            <span>Booking Ref</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{booking.booking_reference}</span>
          </div>
          <div className="payment-page__summary-total">
            <span>Total</span>
            <span>{formatCurrency(booking.total_amount)}</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 10, textAlign: "center" }}>
            By clicking Pay you agree to Razorpay Terms
          </p>
        </aside>
      </div>
    </div>
  );
}
