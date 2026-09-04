import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import "./BookingDetails.css";

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    bookingApi
      .get(id)
      .then((data) => setBooking(data))
      .catch(() => setError("Couldn't load this booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const isIndependent = booking && (booking.trip_type === "independent_package" || booking.package?.trip_type === "independent_package");
  const canCancel = booking && ["pending", "payment_pending", "confirmed", "services_being_arranged", "partially_confirmed", "fully_confirmed"].includes(booking.booking_status);

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

  const handleDelete = async () => {
    if (!window.confirm("Delete this cancelled booking? This cannot be undone.")) return;
    setCancelError("");
    setDeleting(true);
    try {
      await bookingApi.remove(id);
      navigate("/my-bookings");
    } catch (err) {
      setCancelError(err.response?.data?.detail || "Couldn't delete booking. Only cancelled bookings can be deleted.");
    } finally {
      setDeleting(false);
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

  const handleInvoice = async () => {
    try {
      const data = await bookingApi.invoice(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${booking.booking_reference}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCancelError("Couldn't generate invoice.");
    }
  };

  return (
    <div className="bd-page">
      <section className="bd-hero">
        <div className="container bd-hero__inner">
          <Link to="/my-bookings" className="bd-hero__back">&larr; Back to My Bookings</Link>
          <span className="bd-hero__eyebrow">BOOKING DETAILS · {isIndependent ? "Independent Package" : "Group Tour"}</span>
          <h1 className="bd-hero__title">{booking.package.title}</h1>
          <p className="bd-hero__ref">Booking Reference: <strong>{booking.booking_reference}</strong> · {isIndependent ? "We Arrange Your Trip" : "Travel With Us"}</p>
          <p className="bd-hero__ref">Travel Date: {formatDate(booking.travel_date)} · {booking.number_of_travelers} traveler(s) · Payment: {booking.payment_status}</p>
        </div>
      </section>

      <section className="bd-content">
        <div className="container">
          <div className="bd-grid">
            <div className="bd-card">
              <h3 className="bd-card__heading">Trip Details</h3>
              <dl className="bd-dl">
                <dt>Package</dt><dd>{booking.package.title} ({isIndependent ? "Independent" : "Group Tour"})</dd>
                <dt>Travel Date</dt><dd>{formatDate(booking.travel_date)}</dd>
                <dt>Travelers</dt><dd>{booking.number_of_travelers}</dd>
                <dt>Type</dt><dd>{isIndependent ? "Independent Package" : "Group Tour"}</dd>
                <dt>Total Amount</dt><dd>{formatCurrency(booking.total_amount)}</dd>
                {isIndependent && booking.service_total && <><dt>Service Total</dt><dd>{formatCurrency(booking.service_total)}</dd><dt>Service Fee</dt><dd>{formatCurrency(booking.service_fee)}</dd><dt>Discount</dt><dd>{formatCurrency(booking.discount_amount)} {booking.coupon_code && `(${booking.coupon_code})`}</dd></>}
                {!isIndependent && booking.pickup_point_detail && (
                  <>
                    <dt>Pickup Point</dt>
                    <dd>{booking.pickup_point_detail.city ? `${booking.pickup_point_detail.city} — ${booking.pickup_point_detail.name}` : booking.pickup_point_detail.name} {booking.pickup_point_detail.address ? `· ${booking.pickup_point_detail.address}` : ""}</dd>
                  </>
                )}
                {!isIndependent && !booking.pickup_point_detail && booking.package?.pickup_location && (
                  <>
                    <dt>Pickup</dt><dd>{booking.package.pickup_location}</dd>
                  </>
                )}
                <dt>Special Requests</dt><dd>{booking.special_requests || "—"}</dd>
              </dl>

              {isIndependent && booking.booking_services && booking.booking_services.length > 0 && (
                <>
                  <h3 className="bd-card__heading">Services Arranged</h3>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                    {booking.booking_services.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem" }}>
                        <span>
                          {s.status === "confirmed" ? "✅" : s.status === "processing" ? "⏳" : "⏳"} {s.service_name} <small style={{ color: "#64748b" }}>· {s.service_type}</small>
                        </span>
                        <span style={{ textTransform: "capitalize", fontSize: "0.8rem", padding: "2px 8px", borderRadius: 999, background: s.status === "confirmed" ? "#e6f5f2" : "#fef3c7", color: s.status === "confirmed" ? "#0f7a6c" : "#92400e" }}>{s.status}</span>
                      </div>
                    ))}
                    <div style={{ padding: "10px 14px", background: booking.booking_status === "fully_confirmed" ? "#e6f5f2" : "#f8fafc", textAlign: "center", fontWeight: 700, color: booking.booking_status === "fully_confirmed" ? "#0f7a6c" : "#475569" }}>
                      {booking.booking_status === "fully_confirmed" ? "Fully Confirmed ✅" : booking.booking_status === "partially_confirmed" ? "Partially Confirmed" : "Services Being Arranged"}
                    </div>
                  </div>
                </>
              )}

              <h3 className="bd-card__heading">Travelers</h3>
              <ul className="bd-travelers">
                {booking.travelers.map((traveler) => (
                  <li key={traveler.id}>
                    <strong>{traveler.full_name}</strong> &middot; {traveler.age} yrs &middot; {traveler.gender}
                    {traveler.email ? ` · ${traveler.email}` : ""} {traveler.phone ? ` · ${traveler.phone}` : ""}
                    {traveler.govt_id && ` · ID: ${traveler.govt_id}`}
                    {traveler.emergency_contact_name && <><br /><small style={{ color: "#64748b" }}>Emergency: {traveler.emergency_contact_name} {traveler.emergency_contact_phone}</small></>}
                  </li>
                ))}
              </ul>

              {isIndependent && booking.price_breakdown && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Price Breakdown</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}><span>Service Total</span><span>{formatCurrency(booking.price_breakdown.service_total)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}><span>Service Fee</span><span>{formatCurrency(booking.price_breakdown.service_fee)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}><span>Discount</span><span>-{formatCurrency(booking.price_breakdown.discount)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, borderTop: "1px solid #e2e8f0", paddingTop: 6, marginTop: 6 }}><span>Final</span><span>{formatCurrency(booking.price_breakdown.final)}</span></div>
                </div>
              )}

              <Link to={`/my-bookings/${booking.id}/itinerary`} className="bd-link">
                View full itinerary &rarr;
              </Link>
              <button onClick={handleInvoice} className="bd-link" style={{ marginLeft: 12, background: "none", border: "none", color: "#0f7a6c", cursor: "pointer", fontWeight: 700 }}>Download Invoice ↓</button>
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

                {booking.booking_status === "cancelled" && (
                  <button className="bd-btn bd-btn--danger" onClick={handleDelete} disabled={deleting} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    {deleting ? "Deleting..." : "Delete Cancelled Booking"}
                  </button>
                )}

                {booking.payment_status !== "paid" && booking.booking_status !== "cancelled" && (
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
