import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import reviewApi from "../../api/reviewApi";
import useAuth from "../../hooks/useAuth";
import "./MyReviews.css";

function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`stars__star ${n <= value ? "stars__star--filled" : ""}`}
          onClick={() => onChange && onChange(n)}
          disabled={!onChange}
        >
          &#9733;
        </button>
      ))}
    </div>
  );
}

export default function MyReviews() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () => {
    setIsLoading(true);
    setError("");
    bookingApi
      .list({ page_size: 100 })
      .then(async (data) => {
        const myBookings = data.results;
        setBookings(myBookings);

        // No dedicated "my reviews" endpoint exists, so we aggregate:
        // fetch reviews for each distinct package the user has booked,
        // then keep only the ones this user actually wrote.
        const uniquePackageIds = [...new Set(myBookings.map((b) => b.package.id))];
        const reviewLists = await Promise.all(
          uniquePackageIds.map((packageId) =>
            reviewApi
              .listForPackage(packageId)
              .then((list) => list.map((r) => ({ ...r, package_title: myBookings.find((b) => b.package.id === packageId)?.package.title })))
              .catch(() => [])
          )
        );
        const myReviews = reviewLists.flat().filter((r) => r.user_username === user?.username);
        setReviews(myReviews);
      })
      .catch(() => setError("Couldn't load your reviews."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewedBookingIds = new Set(reviews.map((r) => r.booking));
  // Only allow review when trip is completed (travel_date passed + booking completed/confirmed)
  const isCompleted = (b) => {
    const travelPassed = new Date(b.travel_date) <= new Date(new Date().setHours(0,0,0,0));
    const statusOk = ["completed", "confirmed", "fully_confirmed"].includes(b.booking_status);
    return travelPassed && statusOk && b.payment_status === "paid";
  };
  const reviewableBookings = bookings.filter((b) => !reviewedBookingIds.has(b.id) && isCompleted(b));
  const notYetEligible = bookings.filter((b) => !reviewedBookingIds.has(b.id) && !isCompleted(b));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!selectedBookingId || !rating) {
      setFormError("Please select a booking and a rating.");
      return;
    }

    const booking = bookings.find((b) => b.id === Number(selectedBookingId));
    setSubmitting(true);
    try {
      await reviewApi.createForPackage(booking.package.id, {
        booking: booking.id,
        rating,
        comment,
      });
      setRating(0);
      setComment("");
      setSelectedBookingId("");
      load();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <Loader label="Loading your reviews..." />;

  return (
    <div className="container my-reviews">
      <div className="page-header">
        <h1>My Reviews</h1>
        <p>Reviews you've left for packages you've booked.</p>
      </div>

      {error && <EmptyState tone="error" title="Something went wrong" message={error} />}

      {reviewableBookings.length > 0 && (
        <div className="card my-reviews__form">
          <h3>Write a Review — Only after your trip is completed</h3>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 12px" }}>You can rate and review a package only after you complete your trip (travel date passed & booking completed). Group & Independent both require completed trip.</p>
          {formError && <p className="form-error">{formError}</p>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Booking (completed trips only)</label>
              <select
                className="form-select"
                value={selectedBookingId}
                onChange={(event) => setSelectedBookingId(event.target.value)}
              >
                <option value="">Select a booking to review</option>
                {reviewableBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.package.title} ({b.booking_reference}) · {b.travel_date} · {b.booking_status}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Rating</label>
              <Stars value={rating} onChange={setRating} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="comment">Comment</label>
              <textarea
                id="comment"
                rows="3"
                className="form-textarea"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share your experience..."
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      )}
      {reviewableBookings.length === 0 && notYetEligible.length > 0 && (
        <div className="card" style={{ padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px" }}>Trips not yet eligible for review</h4>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 8px" }}>You can review only after trip completion. {notYetEligible.length} booking(s) will become reviewable once travel date passes and booking is marked completed.</p>
          <ul style={{ fontSize: "0.85rem", color: "#475569", margin: 0, paddingLeft: 18 }}>
            {notYetEligible.map((b) => (
              <li key={b.id}>{b.package.title} ({b.booking_reference}) — {b.travel_date} · Status: {b.booking_status} {new Date(b.travel_date) > new Date() ? "· Upcoming" : ""}</li>
            ))}
          </ul>
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" message="You haven't reviewed any packages yet." />
      ) : (
        <div className="my-reviews__list">
          {reviews.map((review) => (
            <div key={review.id} className="card my-reviews__item">
              <div className="my-reviews__item-header">
                <h4>{review.package_title}</h4>
                <Stars value={review.rating} />
              </div>
              <p>{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
