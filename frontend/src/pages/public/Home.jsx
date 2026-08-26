import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DestinationCard from "../../components/DestinationCard";
import PackageCard from "../../components/PackageCard";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import destinationApi from "../../api/destinationApi";
import packageApi from "../../api/packageApi";
import "./Home.css";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const [destinations, setDestinations] = useState([]);
  const [featuredPackages, setFeaturedPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    Promise.all([
      destinationApi.list({ page_size: 4, ordering: "-created_at" }),
      packageApi.featured({ page_size: 3 }),
    ])
      .then(([destinationsData, featuredData]) => {
        setDestinations(destinationsData.results);
        setFeaturedPackages(featuredData.results);
      })
      .catch(() => setError("Couldn't load the homepage right now. Please refresh."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      <section className="hero">
        <div className="container hero__inner">
          <h1 className="hero__title">Your next adventure starts here</h1>
          <p className="hero__subtitle">
            Discover handpicked destinations and all-inclusive tour packages, from beach escapes
            to mountain expeditions.
          </p>

          <form className="hero__search" onSubmit={handleSearch}>
            <input
              type="text"
              className="hero__search-input"
              placeholder="Search destinations or packages (e.g. Goa, Beach, Adventure)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn btn-accent">
              Search
            </button>
          </form>
        </div>
      </section>

      {isLoading ? (
        <Loader label="Loading homepage..." />
      ) : error ? (
        <div className="container section">
          <EmptyState tone="error" title="Something went wrong" message={error} />
        </div>
      ) : (
        <>
          <section className="section">
            <div className="container">
              <div className="section__header">
                <h2>Popular Destinations</h2>
                <p>Places travelers are booking right now</p>
              </div>
              {destinations.length === 0 ? (
                <EmptyState title="No destinations yet" message="Check back soon." />
              ) : (
                <div className="grid grid--destinations">
                  {destinations.map((destination) => (
                    <DestinationCard key={destination.id} destination={destination} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="section section--alt">
            <div className="container">
              <div className="section__header">
                <h2>Featured Packages</h2>
                <p>Our best-value trips, curated by our travel experts</p>
              </div>
              {featuredPackages.length === 0 ? (
                <EmptyState title="No featured packages yet" message="Check back soon." />
              ) : (
                <div className="grid grid--packages">
                  {featuredPackages.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="cta">
        <div className="container cta__inner">
          <h2>Can't find what you're looking for?</h2>
          <p>Browse our full catalog of destinations and packages.</p>
          <a href="/packages" className="btn btn-primary">
            View All Packages
          </a>
        </div>
      </section>
    </div>
  );
}
