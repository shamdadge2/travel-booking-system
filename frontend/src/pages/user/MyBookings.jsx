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
    <div className="myb-page">
      {/* Hero — dark gradient, no image, behind blurred navbar */}
      <section className="myb-hero">
        <div className="container myb-hero__inner">
          <div className="myb-hero__content">
            <span className="myb-hero__eyebrow">YOUR TRIPS</span>
            <h1 className="myb-hero__title">My Bookings</h1>
            <p className="myb-hero__desc">All your trips, past and upcoming — manage, review and track every adventure.</p>
            {!isLoading && !error && bookings.length > 0 && (
              <div className="myb-hero__stats">
                <span className="myb-hero__stat">
                  <strong>{bookings.length}</strong> total booking{bookings.length !== 1 ? "s" : ""}
                </span>
                <span className="myb-hero__dot">·</span>
                <Link to="/packages" className="myb-hero__link">Explore more trips →</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="myb-content">
        <div className="container">
          {isLoading ? (
            <Loader label="Loading your bookings..." />
          ) : error ? (
            <EmptyState tone="error" title="Something went wrong" message={error} />
          ) : bookings.length === 0 ? (
            <div className="myb-empty">
              <div className="myb-empty__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/><circle cx="12" cy="13" r="1.8"/></svg>
              </div>
              <h3>No bookings yet</h3>
              <p>Once you book a trip, it&apos;ll show up here. Start exploring our curated packages.</p>
              <Link to="/packages" className="btn btn-primary myb-empty__cta">Browse Packages</Link>
            </div>
          ) : (
            <div className="myb-list">
              {bookings.map((booking) => (
                <Link key={booking.id} to={`/my-bookings/${booking.id}`} className="myb-card">
                  <div className="myb-card__thumb">
                    {booking.package?.featured_image ? (
                      <img src={booking.package.featured_image} alt={booking.package.title} />
                    ) : (
                      <div className="myb-card__thumb-placeholder">{booking.package?.title?.[0] || "T"}</div>
                    )}
                  </div>
                  <div className="myb-card__main">
                    <div className="myb-card__top">
                      <span className="myb-card__ref">{booking.booking_reference}</span>
                      <span className={`badge ${statusBadgeClass(booking.booking_status)} myb-card__badge`}>{booking.booking_status}</span>
                    </div>
                    <h3 className="myb-card__title">{booking.package?.title || "Package"}</h3>
                    <p className="myb-card__meta">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {formatDate(booking.travel_date)} · {booking.number_of_travelers} traveler(s)
                    </p>
                    <div className="myb-card__foot">
                      <span className="myb-card__amount">{formatCurrency(booking.total_amount)}</span>
                      <span className={`badge ${statusBadgeClass(booking.payment_status)} myb-card__badge--sm`}>{booking.payment_status}</span>
                      <span className="myb-card__cta">View details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
