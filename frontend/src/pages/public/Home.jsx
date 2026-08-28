import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import destinationApi from "../../api/destinationApi";
import packageApi from "../../api/packageApi";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import { API_BASE_URL } from "../../api/axios";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [featuredPackages, setFeaturedPackages] = useState([]);
  const [destCount, setDestCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [destError, setDestError] = useState("");
  const [pkgError, setPkgError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    setDestError("");
    setPkgError("");
    Promise.allSettled([
      destinationApi.list({ page_size: 8, ordering: "-created_at" }),
      packageApi.featured({ page_size: 6 }),
    ]).then((results) => {
      const [destResult, pkgResult] = results;

      if (destResult.status === "fulfilled") {
        const destinationsData = destResult.value;
        setDestinations(destinationsData.results || []);
        setDestCount(destinationsData.count ?? destinationsData.results?.length ?? null);
      } else {
        console.error("Home: failed to load destinations", destResult.reason);
        setDestError("Couldn't load destinations.");
      }

      if (pkgResult.status === "fulfilled") {
        const featuredData = pkgResult.value;
        // featured endpoint may return paginated {results} or plain array
        const list = featuredData.results || featuredData;
        setFeaturedPackages(Array.isArray(list) ? list : []);
      } else {
        console.error("Home: failed to load featured packages", pkgResult.reason);
        setPkgError("Couldn't load featured packages.");
      }

      if (destResult.status === "rejected" && pkgResult.status === "rejected") {
        const isNetworkError =
          !destResult.reason?.response && !pkgResult.reason?.response;
        const status = destResult.reason?.response?.status || pkgResult.reason?.response?.status;
        if (isNetworkError) {
          setError(`Backend is not reachable at ${API_BASE_URL} — the Render free instance may be waking up (wait ~30s) or VITE_API_BASE_URL is misconfigured.`);
        } else if (status === 404) {
          setError(`API returned 404 at ${API_BASE_URL}. Check that VITE_API_BASE_URL ends with /api (e.g. https://travel-booking-system-1-tsta.onrender.com/api).`);
        } else {
          setError("Couldn't load the homepage right now. Please refresh.");
        }
      }
    }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="home">
      {/* =========== HERO - Wanderly reference =========== */}
      <section className="home-hero">
        <div className="home-hero__bg" aria-hidden="true" />
        <div className="home-hero__overlay" aria-hidden="true" />
        <div className="container home-hero__inner">
          <div className="home-hero__main">
            <div className="home-hero__content">
              <h1 className="home-hero__title">Explore the World Beyond Borders</h1>
              <p className="home-hero__desc">
                Discover breathtaking destinations, curated trips, and unforgettable travel experiences designed for explorers.
              </p>
            </div>
            <div className="home-hero__cta-wrap">
              <button className="home-hero__cta" onClick={() => navigate("/packages")} type="button">
                Start Exploring
              </button>
            </div>
          </div>

          <div className="home-hero__stats">
            <div className="home-hero__stat">
              <div className="home-hero__stat-num">{destCount ? `${destCount}+` : "120+"}</div>
              <div className="home-hero__stat-label">DESTINATIONS</div>
            </div>
            <div className="home-hero__stat">
              <div className="home-hero__stat-num">50K+</div>
              <div className="home-hero__stat-label">HAPPY TRAVELERS</div>
            </div>
            <div className="home-hero__stat">
              <div className="home-hero__stat-num">24/7</div>
              <div className="home-hero__stat-label">SUPPORT</div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="container section">
          <Loader label="Curating your next adventure..." />
        </div>
      ) : (
        <>
          {error && (
            <div className="container section" style={{ paddingBottom: 0 }}>
              <div className="home-error">
                <p className="home-error__title">Something went wrong</p>
                <p className="home-error__msg">{error}</p>
                <p className="home-error__msg" style={{ fontSize: "0.85rem", marginTop: 8 }}>
                  If the problem persists, please try again in a moment.
                </p>
                <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>Retry</button>
              </div>
            </div>
          )}

          {/* =========== FEATURED PACKAGES =========== */}
          <section className="section home-featured">
            <div className="container">
              <div className="home-section-head">
                <div className="home-section-head__left">
                  <span className="home-eyebrow">CURATED FOR YOU</span>
                  <h2 className="home-heading">Featured Adventures</h2>
                  <p className="home-sub">Our best-value trips, handpicked by our travel experts for an unforgettable experience.</p>
                </div>
                <Link to="/packages" className="home-link">
                  View All Packages <span aria-hidden="true">→</span>
                </Link>
              </div>

              {pkgError ? (
                <div className="home-error">
                  <p className="home-error__title">Couldn't load featured packages</p>
                  <p className="home-error__msg">{pkgError} Is the API running at {API_BASE_URL}?</p>
                  <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>Retry</button>
                </div>
              ) : featuredPackages.length === 0 ? (
                <div className="home-empty">
                  <p>No featured packages available right now — browse all our trips instead.</p>
                  <Link to="/packages" className="btn btn-outline">Browse all packages</Link>
                </div>
              ) : (
                <div className="home-pkg-grid">
                  {featuredPackages.slice(0, 6).map((pkg) => {
                    const effectivePrice = pkg.is_discounted ? pkg.discount_price : pkg.price;
                    return (
                      <Link key={pkg.id} to={`/packages/${pkg.id}`} className="home-pkg-card">
                        <div className="home-pkg-card__img-wrap">
                          {pkg.featured_image ? (
                            <img src={pkg.featured_image} alt={pkg.title} className="home-pkg-card__img" loading="lazy" />
                          ) : (
                            <div className="home-pkg-card__img home-pkg-card__img--placeholder">
                              <span>{pkg.title?.[0] || "T"}</span>
                            </div>
                          )}
                          <div className="home-pkg-card__top">
                            <span className="home-pkg-card__type">{pkg.package_type}</span>
                            {pkg.is_discounted && <span className="home-pkg-card__sale">Save {formatCurrency(Number(pkg.price) - Number(pkg.discount_price))}</span>}
                          </div>
                          {pkg.average_rating != null && (
                            <span className="home-pkg-card__rating">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                              {Number(pkg.average_rating).toFixed(1)} · {pkg.review_count} reviews
                            </span>
                          )}
                        </div>
                        <div className="home-pkg-card__body">
                          <h3 className="home-pkg-card__title">{pkg.title}</h3>
                          <p className="home-pkg-card__meta">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12z"/><circle cx="12" cy="10" r="3"/></svg>
                            {pkg.destination_name} · {pkg.duration_days}D / {pkg.duration_nights}N
                          </p>
                          {pkg.short_description && (
                            <p className="home-pkg-card__desc">{pkg.short_description}</p>
                          )}
                          <div className="home-pkg-card__foot">
                            <div className="home-pkg-card__price">
                              {pkg.is_discounted && <span className="home-pkg-card__price-old">{formatCurrency(pkg.price)}</span>}
                              <span className="home-pkg-card__price-new">{formatCurrency(effectivePrice)}</span>
                              <span className="home-pkg-card__per">/ person</span>
                            </div>
                            <span className="home-pkg-card__cta">View Details →</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* =========== DESTINATIONS =========== */}
          <section className="section home-destinations">
            <div className="container">
              <div className="home-section-head home-section-head--center">
                <div>
                  <span className="home-eyebrow home-eyebrow--light">DISCOVER PLACES</span>
                  <h2 className="home-heading">Explore Popular Destinations</h2>
                  <p className="home-sub home-sub--center">Handpicked locations from our growing destination catalog.</p>
                </div>
              </div>

              {destError ? (
                <div className="home-error" style={{ maxWidth: 640, margin: "0 auto" }}>
                  <p className="home-error__title">Couldn't load destinations</p>
                  <p className="home-error__msg">{destError}</p>
                  <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>Retry</button>
                </div>
              ) : destinations.length === 0 ? (
                <div className="home-empty home-empty--center">
                  <p>No destinations available yet — we're adding new places all the time, so check back soon.</p>
                  <Link to="/destinations" className="btn btn-primary">Explore destinations</Link>
                </div>
              ) : (
                <>
                  <div className="home-dest-grid">
                    {destinations.slice(0, 8).map((dest) => (
                      <Link key={dest.id} to={`/destinations/${dest.id}`} className="home-dest-card">
                        <div className="home-dest-card__img-wrap">
                          {dest.image ? (
                            <img src={dest.image} alt={dest.name} className="home-dest-card__img" loading="lazy" />
                          ) : (
                            <div className="home-dest-card__img home-dest-card__img--placeholder">
                              <span>{dest.name?.[0] || "D"}</span>
                            </div>
                          )}
                          <div className="home-dest-card__overlay" />
                          <div className="home-dest-card__content">
                            <h3 className="home-dest-card__title">{dest.name}</h3>
                            <p className="home-dest-card__meta">
                              {[dest.city, dest.state, dest.country].filter(Boolean).join(", ")}
                            </p>
                            {dest.description && (
                              <p className="home-dest-card__desc">{dest.description.slice(0, 90)}{dest.description.length > 90 ? "…" : ""}</p>
                            )}
                            <span className="home-dest-card__link">Explore →</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="home-dest-cta">
                    <Link to="/destinations" className="btn btn-outline home-btn-lg">View All Destinations</Link>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* =========== WHY CHOOSE US =========== */}
          <section className="section home-why">
            <div className="container">
              <div className="home-section-head home-section-head--center">
                <div>
                  <span className="home-eyebrow">WHY TRAVEL WITH US</span>
                  <h2 className="home-heading">Why Choose Us</h2>
                  <p className="home-sub home-sub--center">Premium experiences, fair prices and support that stays with you — before, during and after every trip.</p>
                </div>
              </div>
              <div className="home-why-grid">
                <div className="home-why-card">
                  <div className="home-why-card__icon home-why-card__icon--teal">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 8l7-5 7 5v8l-7 5-7-5z"/><path d="M3 8l7 5 7-5"/><path d="M10 21V13"/></svg>
                  </div>
                  <h3>Curated Adventures</h3>
                  <p>Handpicked experiences for unforgettable journeys, selected by local experts who know every trail and story.</p>
                </div>
                <div className="home-why-card">
                  <div className="home-why-card__icon home-why-card__icon--amber">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><circle cx="12" cy="12" r="4"/></svg>
                  </div>
                  <h3>Best Value</h3>
                  <p>Amazing travel experiences at great prices with transparent pricing and no hidden fees — just honest value.</p>
                </div>
                <div className="home-why-card">
                  <div className="home-why-card__icon home-why-card__icon--blue">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5"/></svg>
                  </div>
                  <h3>Trusted Booking</h3>
                  <p>Simple, secure and reliable booking with instant confirmation and flexible policies you can count on.</p>
                </div>
                <div className="home-why-card">
                  <div className="home-why-card__icon home-why-card__icon--emerald">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4 12.91 19.79 19.79 0 0 1 .92 4.27 2 2 0 0 1 2.9.1h3a2 2 0 0 1 2 1.72 12.05 12.05 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 5 5l1.27-1.27a2 2 0 0 1 2.11-.45 12.03 12.03 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <h3>Travel With Confidence</h3>
                  <p>Support throughout your journey — from first enquiry to your safe return, we are here whenever you need us.</p>
                </div>
              </div>
            </div>
          </section>

          {/* =========== CTA =========== */}
          <section className="home-cta">
            <div className="home-cta__bg" aria-hidden="true" />
            <div className="home-cta__overlay" aria-hidden="true" />
            <div className="container home-cta__inner">
              <span className="home-cta__eyebrow">READY TO TRAVEL?</span>
              <h2 className="home-cta__title">Your Next Adventure Starts Here</h2>
              <p className="home-cta__desc">Discover incredible destinations and experiences waiting for you. Your story of a lifetime is just one booking away.</p>
              <div className="home-cta__actions">
                <Link to="/packages" className="btn btn-primary home-cta__btn">
                  Explore All Packages <span aria-hidden="true">→</span>
                </Link>
                <Link to="/destinations" className="btn home-cta__btn-ghost">
                  View Destinations
                </Link>
              </div>
              <p className="home-cta__small">No booking fees · Free cancellation on select packages · Secure payments</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
