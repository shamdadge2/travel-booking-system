import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import { buildUpiLink } from "../../utils/upi";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import paymentApi from "../../api/paymentApi";
import "./Payment.css";

const METHODS = [
  { value: "upi", label: "UPI (PhonePe / GPay / Paytm)" },
  { value: "card", label: "Credit / Debit Card" },
  { value: "netbanking", label: "Net Banking" },
];

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [upiSettings, setUpiSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [method, setMethod] = useState("upi");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [paidPayment, setPaidPayment] = useState(null);

  // UPI is a real money-movement flow, so it can't be self-confirmed:
  // (1) create the pending payment and open the UPI app with the
  // amount prefilled, (2) customer submits the UTR/reference number
  // they got after paying, (3) an admin manually verifies the money
  // actually arrived and marks it paid from the admin panel. The
  // booking stays "pending" the whole time until that happens.
  const [pendingUpiPayment, setPendingUpiPayment] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [referenceSubmitted, setReferenceSubmitted] = useState(false);

  useEffect(() => {
    Promise.all([
      bookingApi.get(id),
      paymentApi.getSettings().catch(() => null),
    ])
      .then(([bookingData, settingsData]) => {
        setBooking(bookingData);
        setUpiSettings(settingsData);
      })
      .catch(() => setLoadError("Couldn't load this booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleUpiPay = async () => {
    setError("");
    if (!upiSettings) {
      setError("UPI payments aren't configured yet — please try Card or Net Banking, or contact support.");
      return;
    }
    setProcessing(true);
    try {
      const payment = await paymentApi.create({ booking: booking.id, payment_method: "upi" });
      setPendingUpiPayment(payment);

      const upiLink = buildUpiLink({
        payeeUpiId: upiSettings.upi_id,
        payeeName: upiSettings.merchant_name,
        amount: booking.total_amount,
        note: `Booking ${booking.booking_reference}`,
      });
      // Navigating to a upi:// URL opens the phone's UPI app chooser
      // with the amount already filled in.
      window.location.href = upiLink;
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't start the UPI payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitReference = async (event) => {
    event.preventDefault();
    setError("");
    if (!referenceNumber.trim()) {
      setError("Please enter the UPI transaction reference (UTR) number from your payment app.");
      return;
    }
    setProcessing(true);
    try {
      await paymentApi.submitReference(pendingUpiPayment.id, { reference_number: referenceNumber.trim() });
      setReferenceSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit your reference number.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMockPay = async (event) => {
    event.preventDefault();
    setError("");
    setProcessing(true);
    try {
      const payment = await paymentApi.create({ booking: booking.id, payment_method: method });
      const processed = await paymentApi.process(payment.id, { simulate_result: "success" });
      setPaidPayment(processed);
    } catch (err) {
      setError(err.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
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
            Transaction: {paidPayment.transaction_id}
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

  // Step 3: reference submitted — now genuinely waiting on an admin,
  // not a fake auto-confirm.
  if (referenceSubmitted) {
    return (
      <div className="container payment-page">
        <div className="card payment-page__result">
          <h2>Payment Under Verification</h2>
          <p>
            Thanks — we've recorded your transaction reference. Our team will verify the payment
            arrived and confirm your booking shortly. You can check the status any time in{" "}
            <Link to={`/my-bookings/${id}`}>My Bookings</Link>.
          </p>
          <button className="btn btn-primary" onClick={() => navigate(`/my-bookings/${id}`)}>
            View Booking Status
          </button>
        </div>
      </div>
    );
  }

  // Step 2: waiting for the customer to come back from their UPI app
  // and tell us the reference number.
  if (pendingUpiPayment) {
    return (
      <div className="container payment-page">
        <div className="card payment-page__result">
          <h2>Complete your payment</h2>
          <p>
            We opened your UPI app with {formatCurrency(booking.total_amount)} ready to send to{" "}
            {upiSettings?.merchant_name}. Once you've paid, enter the transaction reference (UTR)
            number from your UPI app below so we can verify it.
          </p>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={handleSubmitReference}>
            <div className="form-group">
              <label className="form-label" htmlFor="reference_number">UPI Transaction Reference (UTR)</label>
              <input
                id="reference_number"
                className="form-input"
                placeholder="e.g. 402512345678"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={processing}>
              {processing ? "Submitting..." : "Submit for Verification"}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-outline btn-block payment-page__retry"
            onClick={handleUpiPay}
            disabled={processing}
          >
            Reopen UPI App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container payment-page">
      <div className="page-header">
        <h1>Payment</h1>
        <p>
          <Link to={`/my-bookings/${id}`}>&larr; Back to booking</Link> &middot; Booking{" "}
          {booking.booking_reference} &middot; {booking.package.title}
        </p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="payment-page__grid">
        <div className="card payment-page__form">
          <h3>Choose Payment Method</h3>
          <div className="payment-page__methods">
            {METHODS.map((m) => (
              <label key={m.value} className={`payment-page__method ${method === m.value ? "payment-page__method--active" : ""}`}>
                <input
                  type="radio"
                  name="method"
                  value={m.value}
                  checked={method === m.value}
                  onChange={() => setMethod(m.value)}
                />
                {m.label}
              </label>
            ))}
          </div>

          {method === "upi" ? (
            <>
              <p className="payment-page__mock-note">
                Tapping pay opens your UPI app (PhonePe, GPay, Paytm...) with{" "}
                {formatCurrency(booking.total_amount)} already filled in. After paying, you'll
                submit your transaction reference for us to verify — your booking is confirmed
                once that's checked, not automatically.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleUpiPay}
                disabled={processing}
              >
                {processing ? "Opening UPI app..." : `Pay ${formatCurrency(booking.total_amount)} via UPI`}
              </button>
            </>
          ) : (
            <form onSubmit={handleMockPay}>
              {method === "card" && (
                <div className="form-group">
                  <label className="form-label">Card Number</label>
                  <input className="form-input" placeholder="4242 4242 4242 4242" />
                </div>
              )}
              {method === "netbanking" && (
                <div className="form-group">
                  <label className="form-label">Select Bank</label>
                  <select className="form-select">
                    <option>State Bank</option>
                    <option>HDFC Bank</option>
                    <option>ICICI Bank</option>
                  </select>
                </div>
              )}
              <p className="payment-page__mock-note">
                This is a mock payment gateway for demo purposes — no real card/bank details are
                processed. The booking and payment records themselves are real.
              </p>
              <button type="submit" className="btn btn-primary btn-block" disabled={processing}>
                {processing ? "Processing..." : `Pay ${formatCurrency(booking.total_amount)}`}
              </button>
            </form>
          )}
        </div>

        <aside className="card payment-page__summary">
          <h3>Order Summary</h3>
          <div className="payment-page__summary-row">
            <span>{booking.package.title}</span>
            <span>{formatCurrency(booking.total_amount)}</span>
          </div>
          <div className="payment-page__summary-total">
            <span>Total</span>
            <span>{formatCurrency(booking.total_amount)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
