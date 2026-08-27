import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import itineraryApi from "../../api/itineraryApi";
import reviewApi from "../../api/reviewApi";
import "./PackageDetails.css";

export default function PackageDetails() {
  const { id } = useParams();
  const [pkg, setPkg] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    Promise.all([
      packageApi.get(id),
      itineraryApi.listForPackage(id).catch(() => []),
      reviewApi.listForPackage(id).catch(() => []),
    ])
      .then(([pkgData, itineraryData, reviewsData]) => {
        setPkg(pkgData);
        setItinerary(itineraryData);
        setReviews(reviewsData);
      })
      .catch(() => setError("Couldn't load this package. It may not exist or is no longer available."))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <Loader label="Loading package..." />;

  if (error || !pkg) {
    return (
      <div className="container">
        <EmptyState tone="error" title="Package not found" message={error} />
      </div>
    );
  }

  const effectivePrice = pkg.is_discounted ? pkg.discount_price : pkg.price;

  return (
    <div className="pkg-details-page">
      {/* HERO — image is behind blurred navbar, no crossing */}
      <section className="pkg-details-hero">
        <div
          className="pkg-details-hero__bg"
          style={pkg.featured_image ? { backgroundImage: `url("${pkg.featured_image}")` } : undefined}
          aria-hidden="true"
        />
        <div className="pkg-details-hero__overlay" aria-hidden="true" />
        <div className="container pkg-details-hero__inner">
          <div className="pkg-details-hero__content">
            <div className="pkg-details-hero__top">
              <span className="pkg-details-hero__eyebrow">{pkg.package_type}</span>
              {pkg.review_count > 0 && (
                <span className="pkg-details-hero__rating">
                  ★ {Number(pkg.average_rating).toFixed(1)} · {pkg.review_count} review{pkg.review_count === 1 ? "" : "s"}
                </span>
              )}
              {pkg.is_discounted && <span className="pkg-details-hero__sale">Sale</span>}
            </div>
            <h1 className="pkg-details-hero__title">{pkg.title}</h1>
            <p className="pkg-details-hero__meta">
              {pkg.destination?.name || pkg.destination_name} · {pkg.duration_days} Days / {pkg.duration_nights} Nights · {pkg.difficulty} difficulty
            </p>
            {(pkg.start_date || pkg.end_date || pkg.pickup_location) && (
              <div className="pkg-details-hero__essentials">
                {(pkg.start_date || pkg.end_date) && (
                  <span className="pkg-details-hero__essential">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                    {pkg.start_date ? formatDate(pkg.start_date) : "—"}
                    {pkg.end_date ? ` – ${formatDate(pkg.end_date)}` : ""}
                  </span>
                )}
                {pkg.pickup_location && (
                  <span className="pkg-details-hero__essential">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12z"/><circle cx="12" cy="10" r="3"/></svg>
                    {pkg.pickup_location}
                  </span>
                )}
              </div>
            )}
          </div>
          <Link to="/packages" className="pkg-details-hero__back">← Back to Trips</Link>
        </div>
      </section>

      {/* BODY */}
      <div className="pkg-details-body">
        <div className="container pkg-details__grid">
          <div className="pkg-details__main">
            <section className="pkg-details__section">
              <h2>Overview</h2>
              <p>{pkg.description || pkg.short_description || "No overview provided."}</p>
            </section>

            {pkg.images.length > 0 && (
              <section className="pkg-details__section">
                <h2>Places You&apos;ll Visit</h2>
                <div className="places-gallery">
                  {pkg.images.map((image) => (
                    <div key={image.id} className="places-gallery__item">
                      <img src={image.image} alt={image.place_name || pkg.title} />
                      <div className="places-gallery__caption">
                        {image.place_name && <h4>{image.place_name}</h4>}
                        {image.caption && <p>{image.caption}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="pkg-details__section">
              <h2>Inclusions</h2>
              {pkg.inclusions.length === 0 ? (
                <p>No inclusions listed.</p>
              ) : (
                <ul className="checklist checklist--yes">
                  {pkg.inclusions.map((item) => (
                    <li key={item.id}>{item.item}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pkg-details__section">
              <h2>Exclusions</h2>
              {pkg.exclusions.length === 0 ? (
                <p>No exclusions listed.</p>
              ) : (
                <ul className="checklist checklist--no">
                  {pkg.exclusions.map((item) => (
                    <li key={item.id}>{item.item}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pkg-details__section">
              <h2>Itinerary</h2>
              {itinerary.length === 0 ? (
                <p>No itinerary published yet for this package.</p>
              ) : (
                <ol className="itinerary-timeline">
                  {itinerary.map((day) => (
                    <li key={day.id}>
                      <div className="itinerary-timeline__day">Day {day.day_number}</div>
                      <div>
                        <h4>{day.title}</h4>
                        <p>
                          {day.location} · Meals: {day.meals || "—"} · Stay: {day.accommodation || "—"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="pkg-details__section">
              <h2>Reviews</h2>
              {reviews.length === 0 ? (
                <p>No reviews yet — be the first to book and review this package.</p>
              ) : (
                <div className="review-list">
                  {reviews.map((review) => (
                    <div key={review.id} className="review-list__item">
                      <div className="review-list__item-header">
                        <strong>{review.user_username}</strong>
                        <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                      </div>
                      {review.comment && <p>{review.comment}</p>}
                      <span className="review-list__date">{formatDate(review.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="pkg-details__section">
              <h2>FAQs</h2>
              {pkg.faqs.length === 0 ? (
                <p>No FAQs yet for this package.</p>
              ) : (
                <div className="faq-list">
                  {pkg.faqs.map((faq) => (
                    <div key={faq.id} className="faq-list__item">
                      <h4>{faq.question}</h4>
                      <p>{faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="pkg-details__sidebar card">
            {pkg.is_discounted && (
              <span className="pkg-details__old-price">{formatCurrency(pkg.price)}</span>
            )}
            <div className="pkg-details__price">{formatCurrency(effectivePrice)}</div>
            <p className="pkg-details__price-unit">per person</p>

            <p className="pkg-details__slots">
              {pkg.available_slots > 0
                ? `${pkg.available_slots} slot(s) left of ${pkg.max_travelers}`
                : "Sold out"}
            </p>

            {pkg.available_slots > 0 ? (
              <Link to={`/bookings/new?package=${id}`} className="btn btn-primary btn-block pkg-details__cta">
                Book This Package
              </Link>
            ) : (
              <button className="btn btn-primary btn-block" disabled>
                Sold Out
              </button>
            )}
            <p className="pkg-details__sidebar-note">Free cancellation on select packages · Secure payment</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
