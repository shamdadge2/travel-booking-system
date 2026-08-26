import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PackageCard from "../../components/PackageCard";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import destinationApi from "../../api/destinationApi";
import packageApi from "../../api/packageApi";
import "./DestinationDetails.css";

export default function DestinationDetails() {
  const { id } = useParams();
  const [destination, setDestination] = useState(null);
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    Promise.all([
      destinationApi.get(id),
      packageApi.list({ destination: id, page_size: 12 }),
    ])
      .then(([destinationData, packagesData]) => {
        setDestination(destinationData);
        setPackages(packagesData.results);
      })
      .catch(() => setError("Couldn't load this destination. It may not exist."))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <Loader label="Loading destination..." />;

  if (error || !destination) {
    return (
      <div className="container">
        <EmptyState tone="error" title="Destination not found" message={error} />
      </div>
    );
  }

  return (
    <div>
      <div className="destination-hero">
        {destination.image ? (
          <img src={destination.image} alt={destination.name} />
        ) : (
          <div className="destination-hero__placeholder">{destination.name[0]}</div>
        )}
      </div>

      <div className="container">
        <div className="page-header">
          <h1>{destination.name}</h1>
          <p>{destination.full_location}</p>
        </div>

        {destination.description && (
          <p className="destination-description">{destination.description}</p>
        )}

        <div className="section__header">
          <h2>Packages to {destination.name}</h2>
        </div>

        {packages.length === 0 ? (
          <p>No packages currently available for this destination.</p>
        ) : (
          <div className="grid grid--packages">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}

        <p className="destination-back">
          <Link to="/destinations">&larr; Back to all destinations</Link>
        </p>
      </div>
    </div>
  );
}
