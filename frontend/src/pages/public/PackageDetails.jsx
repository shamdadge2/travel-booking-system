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
    <div className="container package-details">
      <div className="package-details__gallery">
        {pkg.featured_image ? (
          <img src={pkg.featured_image} alt={pkg.title} />
        ) : (
          <div className="package-details__gallery-placeholder">{pkg.title[0]}</div>
        )}
      </div>

      <div className="package-details__grid">
        {/* Everything on the left scrolls as one continuous page —
            no tab-clicking required to see inclusions, itinerary, etc. */}
        <div className="package-details__main">
          <span className="badge badge-accent">{pkg.package_type}</span>
          {pkg.review_count > 0 && (
            <span className="badge badge-warning package-details__rating-badge">
              ★ {pkg.average_rating} ({pkg.review_count} review{pkg.review_count === 1 ? "" : "s"})
            </span>
          )}
          <h1>{pkg.title}</h1>
          <p className="package-details__meta">
            {pkg.destination?.name} &middot; {pkg.duration_days} Days / {pkg.duration_nights} Nights &middot;{" "}
            {pkg.difficulty} difficulty
          </p>

          {/* Trip essentials: dates + pickup — shown right under the
              title so they're impossible to miss. */}
          {(pkg.start_date || pkg.end_date || pkg.pickup_location) && (
            <div className="package-details__essentials">
              {(pkg.start_date || pkg.end_date) && (
                <div className="package-details__essential">
                  <span className="package-details__essential-label">Travel Dates</span>
                  <span className="package-details__essential-value">
                    {pkg.start_date ? formatDate(pkg.start_date) : "—"}
                    {pkg.end_date ? ` – ${formatDate(pkg.end_date)}` : ""}
                  </span>
                </div>
              )}
              {pkg.pickup_location && (
                <div className="package-details__essential">
                  <span className="package-details__essential-label">Pickup Location</span>
                  <span className="package-details__essential-value">{pkg.pickup_location}</span>
                </div>
              )}
            </div>
          )}

          <section className="package-details__section">
            <h2>Overview</h2>
            <p>{pkg.description || pkg.short_description || "No overview provided."}</p>
          </section>

          {pkg.images.length > 0 && (
            <section className="package-details__section">
              <h2>Places You'll Visit</h2>
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

          <section className="package-details__section">
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

          <section className="package-details__section">
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

          <section className="package-details__section">
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
                        {day.location} &middot; Meals: {day.meals || "—"} &middot; Stay:{" "}
                        {day.accommodation || "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="package-details__section">
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

          <section className="package-details__section">
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

        <aside className="package-details__sidebar card">
          {pkg.is_discounted && (
            <span className="package-details__old-price">{formatCurrency(pkg.price)}</span>
          )}
          <div className="package-details__price">{formatCurrency(effectivePrice)}</div>
          <p className="package-details__price-unit">per person</p>

          <p className="package-details__slots">
            {pkg.available_slots > 0
              ? `${pkg.available_slots} slot(s) left of ${pkg.max_travelers}`
              : "Sold out"}
          </p>

          {pkg.available_slots > 0 ? (
            <Link to={`/bookings/new?package=${id}`} className="btn btn-primary btn-block">
              Book This Package
            </Link>
          ) : (
            <button className="btn btn-primary btn-block" disabled>
              Sold Out
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
