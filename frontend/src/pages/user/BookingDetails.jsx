import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import "./BookingDetails.css";

export default function BookingDetails() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    bookingApi
      .get(id)
      .then((data) => setBooking(data))
      .catch(() => setError("Couldn't load this booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const canCancel = booking && ["pending", "confirmed"].includes(booking.booking_status);

  const handleCancel = async () => {
    setCancelError("");
    setCancelling(true);
    try {
      const updated = await bookingApi.cancel(id);
      setBooking(updated);
    } catch (err) {
      setCancelError(err.response?.data?.detail || "Couldn't cancel this booking.");
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) return <Loader label="Loading booking..." />;

  if (error || !booking) {
    return (
      <div className="container">
        <EmptyState tone="error" title="Booking not found" message={error} />
      </div>
    );
  }

  return (
    <div className="container booking-details">
      <p>
        <Link to="/my-bookings">&larr; Back to My Bookings</Link>
      </p>

      <div className="page-header">
        <h1>{booking.package.title}</h1>
        <p>
          Booking Reference: <strong>{booking.booking_reference}</strong>
        </p>
      </div>

      <div className="booking-details__grid">
        <div className="card booking-details__main">
          <h3>Trip Details</h3>
          <dl className="booking-details__dl">
            <dt>Travel Date</dt>
            <dd>{formatDate(booking.travel_date)}</dd>
            <dt>Travelers</dt>
            <dd>{booking.number_of_travelers}</dd>
            <dt>Total Amount</dt>
            <dd>{formatCurrency(booking.total_amount)}</dd>
            <dt>Special Requests</dt>
            <dd>{booking.special_requests || "—"}</dd>
          </dl>

          <h3>Travelers</h3>
          <ul className="booking-details__travelers">
            {booking.travelers.map((traveler) => (
              <li key={traveler.id}>
                <strong>{traveler.full_name}</strong> &middot; {traveler.age} yrs &middot;{" "}
                {traveler.gender}
                {traveler.email ? ` · ${traveler.email}` : ""}
              </li>
            ))}
          </ul>

          <p>
            <Link to={`/my-bookings/${booking.id}/itinerary`}>View full itinerary &rarr;</Link>
          </p>
        </div>

        <aside className="card booking-details__sidebar">
          <h3>Status</h3>
          <p>
            Booking:{" "}
            <span className={`badge ${booking.booking_status === "cancelled" ? "badge-danger" : "badge-success"}`}>
              {booking.booking_status}
            </span>
          </p>
          <p>
            Payment: <span className="badge badge-success">{booking.payment_status}</span>
          </p>

          {cancelError && <p className="form-error">{cancelError}</p>}

          {canCancel && (
            <button className="btn btn-danger btn-block" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </button>
          )}

          {booking.payment_status !== "paid" && (
            <Link to={`/payment/${id}`} className="btn btn-primary btn-block booking-details__pay-btn">
              Pay Now
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
