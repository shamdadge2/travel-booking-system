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
  }, [search, type, sort]);

  return (
    <div className="container">
      <div className="page-header">
        <h1>Tour Packages</h1>
        <p>Find the perfect trip, filtered by type and budget.</p>
      </div>

      <div className="packages-toolbar">
        <input
          type="text"
          className="form-input"
          placeholder="Search packages..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select className="form-select" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All Types</option>
          {PACKAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="">Sort by</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

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
  );
}
