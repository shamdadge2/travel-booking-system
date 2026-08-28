import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PackageCard from "../../components/PackageCard";
import EmptyState from "../../components/EmptyState";
import Loader from "../../components/Loader";
import packageApi from "../../api/packageApi";
import "./SearchResults.css";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    packageApi
      .search({ q: query, page_size: 24 }, { signal: controller.signal })
      .then((data) => setResults(data.results))
      .catch((err) => {
        if (err.name !== "CanceledError") {
          setError("Couldn't load search results. Please try again.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [query]);

  return (
    <div className="container search-results">
      <div className="page-header">
        <h1>Search Results</h1>
        <p>
          {query ? (
            <>
              Showing results for <strong>&ldquo;{query}&rdquo;</strong>
            </>
          ) : (
            "Showing all packages"
          )}
        </p>
      </div>

      {isLoading ? (
        <Loader label="Searching..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : results.length === 0 ? (
        <EmptyState
          title="No results found"
          message={`We couldn't find anything matching "${query}". Try a different search term.`}
        />
      ) : (
        <div className="grid grid--packages">
          {results.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
