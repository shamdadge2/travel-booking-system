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
    <div className="container">
      <div className="page-header">
        <h1>Destinations</h1>
        <p>Browse every destination we currently offer tour packages for.</p>
      </div>

      <div className="destinations-toolbar">
        <input
          type="text"
          className="form-input"
          placeholder="Search by name, city or country..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

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
  );
}
