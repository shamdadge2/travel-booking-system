import { useEffect, useState } from "react";
import DestinationCard from "../../components/DestinationCard";
import EmptyState from "../../components/EmptyState";
import Loader from "../../components/Loader";
import destinationApi from "../../api/destinationApi";
import "./Destinations.css";

export default function Destinations() {
  const [search, setSearch] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    const params = { page_size: 24 };
    if (search) params.search = search;

    destinationApi
      .list(params, { signal: controller.signal })
      .then((data) => setDestinations(data.results))
      .catch((err) => {
        if (err.name !== "CanceledError") {
          setError("Couldn't load destinations. Please try again.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [search]);

  return (
    <div className="dest-page">
      {/* Hero - matches homepage theme */}
      <section className="dest-hero">
        <div className="dest-hero__bg" aria-hidden="true" />
        <div className="dest-hero__overlay" aria-hidden="true" />
        <div className="container dest-hero__inner">
          <div className="dest-hero__content">
            <span className="dest-hero__eyebrow">EXPLORE PLACES</span>
            <h1 className="dest-hero__title">Find Your Next Destination</h1>
            <p className="dest-hero__desc">
              Browse every destination we currently offer tour packages for — from tropical beaches to mountain retreats.
            </p>
            <div className="dest-hero__search">
              <svg className="dest-hero__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="text"
                className="dest-hero__input"
                placeholder="Search by name, city or country..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="dest-hero__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="dest-hero__hint">Try “Goa”, “Kerala” or “Switzerland”</p>
          </div>
        </div>
      </section>

      {/* Content - card grid */}
      <section className="dest-content">
        <div className="container">

          {isLoading ? (
            <Loader label="Loading destinations..." />
          ) : error ? (
            <EmptyState tone="error" title="Something went wrong" message={error} />
          ) : destinations.length === 0 ? (
            <EmptyState title="No destinations found" message="Try a different search term." />
          ) : (
            <div className="grid grid--destinations">
              {destinations.map((destination) => (
                <DestinationCard key={destination.id} destination={destination} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
