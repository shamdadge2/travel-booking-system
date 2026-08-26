import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import itineraryApi from "../../api/itineraryApi";
import "./Itinerary.css";

export default function Itinerary() {
  const { bookingId } = useParams();
  const [packageTitle, setPackageTitle] = useState("");
  const [itinerary, setItinerary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // The booking tells us which package this trip is for; the
    // itinerary itself is fetched per-package, not per-booking.
    bookingApi
      .get(bookingId)
      .then((booking) => {
        setPackageTitle(booking.package.title);
        return itineraryApi.listForPackage(booking.package.id);
      })
      .then((days) => setItinerary(days))
      .catch(() => setError("Couldn't load the itinerary for this booking."))
      .finally(() => setIsLoading(false));
  }, [bookingId]);

  if (isLoading) return <Loader label="Loading itinerary..." />;

  return (
    <div className="container user-itinerary">
      <p>
        <Link to={`/my-bookings/${bookingId}`}>&larr; Back to Booking</Link>
      </p>

      <div className="page-header">
        <h1>Trip Itinerary</h1>
        <p>{packageTitle}</p>
      </div>

      {error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : itinerary.length === 0 ? (
        <EmptyState title="No itinerary yet" message="The full day-by-day plan hasn't been published for this package yet." />
      ) : (
        <ol className="itinerary-timeline">
          {itinerary.map((day) => (
            <li key={day.id}>
              <div className="itinerary-timeline__day">Day {day.day_number}</div>
              <div>
                <h4>{day.title}</h4>
                {day.location && <p>{day.location}</p>}
                {day.activities && <p>Activities: {day.activities}</p>}
                <p>
                  Meals: {day.meals || "—"} &middot; Stay: {day.accommodation || "—"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
