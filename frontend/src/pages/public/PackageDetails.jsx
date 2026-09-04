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

  const isIndependent = pkg.trip_type === "independent_package";
  const effectivePrice = isIndependent
    ? (pkg.computed_price || pkg.price_breakdown?.final_price || pkg.price)
    : (pkg.is_discounted ? pkg.discount_price : pkg.price);

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
              <span className="pkg-details-hero__eyebrow" style={isIndependent ? { background: "#0fb5a2", color: "#0a1628" } : undefined}>
                {isIndependent ? "Independent Package · We Arrange Your Trip" : `Group Tour · Travel With Us · ${pkg.package_type}`}
              </span>
              {pkg.review_count > 0 && (
                <span className="pkg-details-hero__rating">
                  ★ {Number(pkg.average_rating).toFixed(1)} · {pkg.review_count} review{pkg.review_count === 1 ? "" : "s"}
                </span>
              )}
              {pkg.is_discounted && !isIndependent && <span className="pkg-details-hero__sale">Sale</span>}
              {isIndependent && pkg.best_time_to_visit && <span className="pkg-details-hero__sale" style={{ background: "#fff", color: "#0f172a" }}>Best: {pkg.best_time_to_visit}</span>}
            </div>
            <h1 className="pkg-details-hero__title">{pkg.title}</h1>
            <p className="pkg-details-hero__meta">
              {pkg.destination?.name || pkg.destination_name} · {pkg.duration_days} Days / {pkg.duration_nights} Nights · {pkg.difficulty} difficulty
              {isIndependent ? ` · ${pkg.max_travelers} travelers max` : ""}
            </p>
            {(pkg.start_date || pkg.end_date || pkg.pickup_location || isIndependent) && (
              <div className="pkg-details-hero__essentials">
                {!isIndependent && (pkg.start_date || pkg.end_date) && (
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
                {isIndependent && (
                  <span className="pkg-details-hero__essential">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
                    {pkg.category || pkg.package_type}
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
              {isIndependent && pkg.best_time_to_visit && <p style={{ marginTop: 8, color: "#0f7a6c", fontWeight: 600 }}>🗓 Best time to visit: {pkg.best_time_to_visit}</p>}
            </section>

            {!isIndependent && pkg.pickup_points && pkg.pickup_points.length > 0 && (
              <section className="pkg-details__section">
                <h2>📍 Pickup Points — We Bring You With Us</h2>
                <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 12 }}>For group tours we manage all travel from pickup point onwards. Choose nearest hub at booking — use your location for suggestion.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                  {pkg.pickup_points.map((pp) => (
                    <div key={pp.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>{pp.city}</div>
                      <div style={{ fontSize: "0.88rem", color: "#475569" }}>{pp.name}</div>
                      {pp.address && <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>{pp.address}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isIndependent && pkg.price_breakdown && (
              <section className="pkg-details__section">
                <h2>Services & Price Breakdown</h2>
                <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 12 }}>All services are arranged by us — you pay one package price. Breakdown shown for transparency.</p>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  {pkg.price_breakdown.services.map((s) => (
                    <div key={s.service_name + s.quantity} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem" }}>
                      <span>{s.service_name} <small style={{ color: "#64748b" }}>×{s.quantity}</small> <small style={{ color: "#0f7a6c", textTransform: "capitalize" }}>· {s.service_type}</small></span>
                      <strong>{formatCurrency(s.total_price)}</strong>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", fontSize: "0.92rem" }}>
                    <span>Service Cost</span><span>{formatCurrency(pkg.price_breakdown.service_cost)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", fontSize: "0.92rem" }}>
                    <span>Company Service Fee</span><span>{formatCurrency(pkg.price_breakdown.service_fee)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#0f172a", color: "#fff", fontWeight: 800 }}>
                    <span>Final Package Price</span><span>{formatCurrency(pkg.price_breakdown.final_price)}</span>
                  </div>
                </div>
              </section>
            )}

            {isIndependent && pkg.price_breakdown?.option_groups && Object.keys(pkg.price_breakdown.option_groups).length > 0 && (
              <>
                {pkg.price_breakdown.option_groups.transport && (
                  <section className="pkg-details__section">
                    <h2>🚐 Travel Options — How You’ll Go</h2>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 12 }}>Choose how you travel to the destination. All options include airport assistance; pick at booking.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                      {pkg.price_breakdown.option_groups.transport.map((opt) => (
                        <div key={opt.id} style={{ border: opt.is_default_selected ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: opt.is_default_selected ? "#e6f5f2" : "#fff" }}>
                          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>{opt.service_name}</div>
                          <div style={{ fontSize: "0.78rem", color: "#0f7a6c", textTransform: "capitalize", marginBottom: 4 }}>{opt.service_category} · {opt.service_type}</div>
                          <p style={{ fontSize: "0.84rem", color: "#475569", margin: "6px 0" }}>{opt.description || "Comfortable travel"}</p>
                          {opt.extra_data?.vehicle && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Vehicle: {opt.extra_data.vehicle} {opt.extra_data.capacity ? `· ${opt.extra_data.capacity} seats` : ""}</div>}
                          <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(opt.total_price)}</div>
                          {opt.is_default_selected && <span style={{ fontSize: "0.7rem", background: "#0f7a6c", color: "#fff", padding: "2px 6px", borderRadius: 999 }}>Default</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {pkg.price_breakdown.option_groups.local_vehicle && (
                  <section className="pkg-details__section">
                    <h2>🚗 Local Vehicle — Sightseeing Transfers</h2>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 12 }}>Private vehicle for daily sightseeing and hotel transfers.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                      {pkg.price_breakdown.option_groups.local_vehicle.map((opt) => (
                        <div key={opt.id} style={{ border: opt.is_default_selected ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: opt.is_default_selected ? "#e6f5f2" : "#fff" }}>
                          <div style={{ fontWeight: 800 }}>{opt.service_name}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{opt.service_category}</div>
                          <p style={{ fontSize: "0.84rem", color: "#475569" }}>{opt.description}</p>
                          {opt.extra_data?.vehicle && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{opt.extra_data.vehicle} · {opt.extra_data.ac || ""} · {opt.extra_data.capacity} seats</div>}
                          <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(opt.total_price)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {pkg.price_breakdown.option_groups.hotel && (
                  <section className="pkg-details__section">
                    <h2>🏨 Hotel Options — Choose by Budget</h2>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 12 }}>Pick hotel tier that fits your budget. All include 4 nights with breakfast.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                      {pkg.price_breakdown.option_groups.hotel.map((opt) => (
                        <div key={opt.id} style={{ border: opt.is_default_selected ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: opt.is_default_selected ? "#e6f5f2" : "#fff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "0.95rem" }}>{opt.service_name}</strong>
                            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 999, background: Number(opt.total_price) > 15000 ? "#fee2e2" : Number(opt.total_price) > 9000 ? "#fef3c7" : "#dcfce7", color: Number(opt.total_price) > 15000 ? "#991b1b" : Number(opt.total_price) > 9000 ? "#92400e" : "#166534" }}>{Number(opt.total_price) > 15000 ? "Luxury" : Number(opt.total_price) > 9000 ? "Standard" : "Budget"}</span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{opt.extra_data?.stars ? `${opt.extra_data.stars}★ · ${opt.extra_data.room}` : opt.location}</div>
                          <p style={{ fontSize: "0.84rem", color: "#475569", margin: "6px 0" }}>{opt.description}</p>
                          {opt.extra_data?.per_night && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{formatCurrency(opt.extra_data.per_night)} / night</div>}
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", marginTop: 6 }}>{formatCurrency(opt.total_price)} <small style={{ fontWeight: 400, color: "#64748b", fontSize: "0.78rem" }}>for 4N</small></div>
                          {opt.is_default_selected && <span style={{ fontSize: "0.7rem", background: "#0f7a6c", color: "#fff", padding: "2px 6px", borderRadius: 999 }}>Default</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {isIndependent && pkg.package_services && pkg.package_services.length > 0 && (
              <section className="pkg-details__section">
                <h2>Accommodation & Services</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {pkg.package_services.map((ps) => (
                    <div key={ps.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ fontSize: "0.95rem" }}>{ps.service?.name || "Service"} </strong>
                        {ps.is_user_selectable ? <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "0.72rem", padding: "2px 8px", borderRadius: 999, marginLeft: 6 }}>Choose: {ps.option_group}</span> : <span style={{ background: ps.is_included ? "#e6f5f2" : "#fef2f2", color: ps.is_included ? "#0f7a6c" : "#dc2626", fontSize: "0.72rem", padding: "2px 8px", borderRadius: 999, marginLeft: 6 }}>{ps.is_included ? "Included" : "Excluded"}</span>}
                        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.84rem" }}>{ps.service?.description || ps.notes || ""} · {ps.service?.service_type} · Qty {ps.quantity}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700 }}>{formatCurrency(ps.total_price)}</div>
                        <small style={{ color: "#64748b" }}>{formatCurrency(ps.unit_price)} × {ps.quantity}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isIndependent && pkg.travel_dates && pkg.travel_dates.length > 0 && (
              <section className="pkg-details__section">
                <h2>Travel Dates & Availability</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  {pkg.travel_dates.map((td) => (
                    <div key={td.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px", background: td.status === "available" ? "#e6f5f2" : td.status === "limited" ? "#fef3c7" : "#fef2f2" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{formatDate(td.travel_date)}</div>
                      <div style={{ fontSize: "0.78rem", textTransform: "capitalize", color: td.status === "available" ? "#0f7a6c" : td.status === "limited" ? "#92400e" : "#dc2626" }}>{td.status === "available" ? "✅ Available" : td.status === "limited" ? "⚠️ Limited" : "❌ Not Available"}</div>
                      {td.available_slots != null && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{td.available_slots} slots</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

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
              <h2>What&apos;s Included</h2>
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
              <h2>What&apos;s Excluded</h2>
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
            {isIndependent && (
              <section className="pkg-details__section">
                <h2>Important Information & Cancellation Policy</h2>
                <ul className="checklist checklist--yes">
                  <li>All services confirmed after payment — you&apos;ll get service-wise status.</li>
                  <li>Cancellation refunds as per policy: 30+ days 90%, 15-29 days 70%, 7-14 days 50%, &lt;7 days no refund (configurable by admin).</li>
                  <li>Carry valid govt ID/passport as required.</li>
                </ul>
              </section>
            )}

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
            {pkg.is_discounted && !isIndependent && (
              <span className="pkg-details__old-price">{formatCurrency(pkg.price)}</span>
            )}
            <div className="pkg-details__price">{formatCurrency(effectivePrice)}</div>
            <p className="pkg-details__price-unit">{isIndependent ? "per package (service total)" : "per person"}</p>

            <p className="pkg-details__slots">
              {pkg.available_slots > 0
                ? `${pkg.available_slots} slot(s) left of ${pkg.max_travelers}`
                : "Sold out"}
            </p>

            {pkg.available_slots > 0 ? (
              <Link to={isIndependent ? `/bookings/independent?package=${id}` : `/bookings/new?package=${id}`} className="btn btn-primary btn-block pkg-details__cta">
                {isIndependent ? "Book Independent Package" : "Book This Package"}
              </Link>
            ) : (
              <button className="btn btn-primary btn-block" disabled>
                Sold Out
              </button>
            )}
            {isIndependent && pkg.price_breakdown && (
              <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10, fontSize: "0.84rem", color: "#475569" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Services</span><span>{formatCurrency(pkg.price_breakdown.service_cost)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fee</span><span>{formatCurrency(pkg.price_breakdown.service_fee)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#0f172a", marginTop: 4 }}><span>Total</span><span>{formatCurrency(pkg.price_breakdown.final_price)}</span></div>
                <Link to={`/bookings/independent?package=${id}`} style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: "0.78rem", color: "#0f7a6c" }}>View price breakdown →</Link>
              </div>
            )}
            <p className="pkg-details__sidebar-note">Free cancellation on select packages · Secure payment</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
