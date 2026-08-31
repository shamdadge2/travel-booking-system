import { useEffect, useState } from "react";
import PackageCard from "../../components/PackageCard";
import EmptyState from "../../components/EmptyState";
import Loader from "../../components/Loader";
import packageApi from "../../api/packageApi";
import "./Packages.css";

const PACKAGE_TYPES = ["adventure", "honeymoon", "family", "pilgrimage", "wildlife", "beach", "cultural", "luxury"];

export default function Packages() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [tripType, setTripType] = useState("");
  const [sort, setSort] = useState("");
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    const params = { page_size: 24 };
    if (search) params.search = search;
    if (type) params.package_type = type;
    if (tripType) params.trip_type = tripType;
    if (sort === "price_asc") params.ordering = "price";
    if (sort === "price_desc") params.ordering = "-price";

    packageApi
      .list(params, { signal: controller.signal })
      .then((data) => setPackages(data.results))
      .catch((err) => {
        if (err.name !== "CanceledError") {
          setError("Couldn't load packages. Please try again.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [search, type, tripType, sort]);

  return (
    <div className="pkg-page">
      {/* Hero - matches homepage + destinations */}
      <section className="pkg-hero">
        <div className="pkg-hero__bg" aria-hidden="true" />
        <div className="pkg-hero__overlay" aria-hidden="true" />
        <div className="container pkg-hero__inner">
          <div className="pkg-hero__content">
            <span className="pkg-hero__eyebrow">CURATED TRIPS</span>
            <h1 className="pkg-hero__title">Explore Amazing Trips</h1>
            <p className="pkg-hero__desc">
              Find the perfect trip, filtered by type and budget — adventure, honeymoon, family and more.
            </p>
            <div className="pkg-hero__filters">
              <div className="pkg-hero__search">
                <svg className="pkg-hero__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  type="text"
                  className="pkg-hero__input"
                  placeholder="Search packages..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button type="button" className="pkg-hero__clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
                )}
              </div>

              <div className="pkg-hero__selects">
                <select className="pkg-hero__select" value={tripType} onChange={(event) => setTripType(event.target.value)}>
                  <option value="">All Trip Types</option>
                  <option value="group_tour">Group Tour — Travel With Us</option>
                  <option value="independent_package">Independent — We Arrange Your Trip</option>
                </select>

                <select className="pkg-hero__select" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">All Categories</option>
                  {PACKAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>

                <select className="pkg-hero__select" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="">Sort by</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content - grid untouched */}
      <section className="pkg-content">
        <div className="container">
          {!isLoading && !error && packages.length > 0 && (
            <div className="pkg-content__head">
              <p className="pkg-content__count">
                Showing <strong>{packages.length}</strong> trip{packages.length !== 1 ? "s" : ""}
                {type ? <> · {type}</> : null}
                {tripType ? <> · {tripType === "independent_package" ? "Independent" : "Group Tour"}</> : null}
              </p>
              {(search || type || tripType || sort) && (
                <button
                  type="button"
                  className="pkg-content__reset"
                  onClick={() => { setSearch(""); setType(""); setTripType(""); setSort(""); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <Loader label="Loading packages..." />
          ) : error ? (
            <EmptyState tone="error" title="Something went wrong" message={error} />
          ) : packages.length === 0 ? (
            <EmptyState title="No packages found" message="Try adjusting your search or filters." />
          ) : (
            <div className="grid grid--packages">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
