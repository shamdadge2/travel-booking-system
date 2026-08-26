import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import reviewApi from "../../api/reviewApi";
import "./AdminTable.css";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = () => {
    setIsLoading(true);
    setError("");

    // There's no GET /api/reviews/ "list everything" endpoint on the
    // backend — reviews are only listable per-package. So: fetch every
    // package, then fetch each one's reviews and flatten the results.
    packageApi
      .list({ page_size: 100 })
      .then(async (data) => {
        const packages = data.results;
        const reviewLists = await Promise.all(
          packages.map((pkg) =>
            reviewApi
              .listForPackage(pkg.id)
              .then((list) => list.map((r) => ({ ...r, package_title: pkg.title })))
              .catch(() => [])
          )
        );
        setReviews(reviewLists.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      })
      .catch(() => setError("Couldn't load reviews."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (review) => {
    setActionError("");
    try {
      await reviewApi.remove(review.id);
      setReviews(reviews.filter((r) => r.id !== review.id));
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't remove this review.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Reviews</h1>
          <p>Moderate customer reviews</p>
        </div>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}

      {isLoading ? (
        <Loader label="Loading reviews..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Package</th>
                <th>User</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.id}</td>
                  <td>{review.package_title}</td>
                  <td>{review.user_username}</td>
                  <td>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{review.comment}</td>
                  <td className="admin-table__actions">
                    <button className="danger" onClick={() => handleDelete(review)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
