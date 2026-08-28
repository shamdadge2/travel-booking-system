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
      <div className="bd-page">
        <div className="container">
          <EmptyState tone="error" title="Booking not found" message={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="bd-page">
      <section className="bd-hero">
        <div className="container bd-hero__inner">
          <Link to="/my-bookings" className="bd-hero__back">&larr; Back to My Bookings</Link>
          <span className="bd-hero__eyebrow">BOOKING DETAILS</span>
          <h1 className="bd-hero__title">{booking.package.title}</h1>
          <p className="bd-hero__ref">Booking Reference: <strong>{booking.booking_reference}</strong></p>
        </div>
      </section>

      <section className="bd-content">
        <div className="container">
          <div className="bd-grid">
            <div className="bd-card">
              <h3 className="bd-card__heading">Trip Details</h3>
              <dl className="bd-dl">
                <dt>Travel Date</dt>
                <dd>{formatDate(booking.travel_date)}</dd>
                <dt>Travelers</dt>
                <dd>{booking.number_of_travelers}</dd>
                <dt>Total Amount</dt>
                <dd>{formatCurrency(booking.total_amount)}</dd>
                <dt>Special Requests</dt>
                <dd>{booking.special_requests || "—"}</dd>
              </dl>

              <h3 className="bd-card__heading">Travelers</h3>
              <ul className="bd-travelers">
                {booking.travelers.map((traveler) => (
                  <li key={traveler.id}>
                    <strong>{traveler.full_name}</strong> &middot; {traveler.age} yrs &middot;{" "}
                    {traveler.gender}
                    {traveler.email ? ` · ${traveler.email}` : ""}
                  </li>
                ))}
              </ul>

              <Link to={`/my-bookings/${booking.id}/itinerary`} className="bd-link">
                View full itinerary &rarr;
              </Link>
            </div>

            <aside className="bd-card bd-sidebar">
              <h3 className="bd-card__heading">Status</h3>
              <div className="bd-status-row">
                <span className="bd-status-label">Booking</span>
                <span className={`badge ${booking.booking_status === "cancelled" ? "badge-danger" : "badge-success"}`}>
                  {booking.booking_status}
                </span>
              </div>
              <div className="bd-status-row">
                <span className="bd-status-label">Payment</span>
                <span className={`badge ${booking.payment_status === "paid" ? "badge-success" : "badge-warning"}`}>
                  {booking.payment_status}
                </span>
              </div>

              {cancelError && <p className="bd-error">{cancelError}</p>}

              <div className="bd-actions">
                {canCancel && (
                  <button className="bd-btn bd-btn--danger" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? "Cancelling..." : "Cancel Booking"}
                  </button>
                )}

                {booking.payment_status !== "paid" && (
                  <Link to={`/payment/${id}`} className="bd-btn bd-btn--primary">
                    Pay Now
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
