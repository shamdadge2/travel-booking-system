import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import EmptyState from "../../components/EmptyState";
import Loader from "../../components/Loader";
import bookingApi from "../../api/bookingApi";
import "./MyBookings.css";

function statusBadgeClass(status) {
  if (status === "confirmed" || status === "paid" || status === "completed") return "badge-success";
  if (status === "cancelled" || status === "failed") return "badge-danger";
  return "badge-warning";
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    bookingApi
      .list({ ordering: "-created_at" })
      .then((data) => setBookings(data.results))
      .catch(() => setError("Couldn't load your bookings. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="container my-bookings">
      <div className="page-header">
        <h1>My Bookings</h1>
        <p>All your trips, past and upcoming.</p>
      </div>

      {isLoading ? (
        <Loader label="Loading your bookings..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          message="Once you book a trip, it'll show up here."
        />
      ) : (
        <div className="my-bookings__list">
          {bookings.map((booking) => (
            <Link key={booking.id} to={`/my-bookings/${booking.id}`} className="my-bookings__row card">
              <div className="my-bookings__row-main">
                <h3>{booking.package.title}</h3>
                <p>
                  {booking.booking_reference} &middot; {formatDate(booking.travel_date)} &middot;{" "}
                  {booking.number_of_travelers} traveler(s)
                </p>
              </div>
              <div className="my-bookings__row-side">
                <span className="my-bookings__amount">{formatCurrency(booking.total_amount)}</span>
                <span className={`badge ${statusBadgeClass(booking.booking_status)}`}>
                  {booking.booking_status}
                </span>
                <span className={`badge ${statusBadgeClass(booking.payment_status)}`}>
                  {booking.payment_status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
