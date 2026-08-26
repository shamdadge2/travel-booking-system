import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import bookingApi from "../../api/bookingApi";
import "./CreateBooking.css";

const EMPTY_TRAVELER = { full_name: "", age: "", gender: "male", phone: "", email: "", nationality: "" };

export default function CreateBooking() {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get("package");
  const navigate = useNavigate();

  const [pkg, setPkg] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState([{ ...EMPTY_TRAVELER }]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!packageId) {
      setLoadError("No package was selected. Please go back and choose a package to book.");
      setIsLoading(false);
      return;
    }
    packageApi
      .get(packageId)
      .then((data) => setPkg(data))
      .catch(() => setLoadError("Couldn't load this package."))
      .finally(() => setIsLoading(false));
  }, [packageId]);

  if (isLoading) return <Loader label="Loading package..." />;

  if (loadError || !pkg) {
    return (
      <div className="container">
        <EmptyState tone="error" title="Can't book right now" message={loadError} />
      </div>
    );
  }

  const effectivePrice = pkg.is_discounted ? pkg.discount_price : pkg.price;
  const totalAmount = effectivePrice * travelers.length;

  const updateTraveler = (index, field, value) => {
    const updated = [...travelers];
    updated[index] = { ...updated[index], [field]: value };
    setTravelers(updated);
  };

  const addTraveler = () => {
    if (travelers.length >= pkg.available_slots) {
      setError(`Only ${pkg.available_slots} slot(s) available for this package.`);
      return;
    }
    setTravelers([...travelers, { ...EMPTY_TRAVELER }]);
  };

  const removeTraveler = (index) => {
    if (travelers.length === 1) return;
    setTravelers(travelers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!travelDate) {
      setError("Please select a travel date.");
      return;
    }
    if (travelers.some((t) => !t.full_name || !t.age)) {
      setError("Please fill in at least full name and age for every traveler.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        package: pkg.id,
        travel_date: travelDate,
        number_of_travelers: travelers.length,
        special_requests: specialRequests,
        travelers: travelers.map((t) => ({ ...t, age: Number(t.age) })),
      };
      const booking = await bookingApi.create(payload);
      navigate(`/my-bookings/${booking.id}`);
    } catch (err) {
      const data = err.response?.data;
      const message =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data)[0] : null) ||
        "Couldn't create this booking. Please try again.";
      setError(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container create-booking">
      <div className="page-header">
        <h1>Book: {pkg.title}</h1>
        <p>
          <Link to={`/packages/${pkg.id}`}>&larr; Back to package details</Link> &middot;{" "}
          {pkg.available_slots} slot(s) available
        </p>
      </div>

      {error && <p className="form-error create-booking__error">{error}</p>}

      <form onSubmit={handleSubmit} className="create-booking__grid">
        <div className="create-booking__main">
          <div className="card create-booking__section">
            <h3>Trip Details</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="travel_date">Travel Date</label>
              <input
                id="travel_date"
                type="date"
                className="form-input"
                min={new Date().toISOString().split("T")[0]}
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="special_requests">Special Requests (optional)</label>
              <textarea
                id="special_requests"
                rows="3"
                className="form-textarea"
                value={specialRequests}
                onChange={(event) => setSpecialRequests(event.target.value)}
              />
            </div>
          </div>

          {travelers.map((traveler, index) => (
            <div key={index} className="card create-booking__section">
              <div className="create-booking__traveler-header">
                <h3>Traveler {index + 1}</h3>
                {travelers.length > 1 && (
                  <button type="button" className="create-booking__remove" onClick={() => removeTraveler(index)}>
                    Remove
                  </button>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={traveler.full_name} onChange={(e) => updateTraveler(index, "full_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input type="number" min="0" className="form-input" value={traveler.age} onChange={(e) => updateTraveler(index, "age", e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={traveler.gender} onChange={(e) => updateTraveler(index, "gender", e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nationality</label>
                  <input className="form-input" value={traveler.nationality} onChange={(e) => updateTraveler(index, "nationality", e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone (optional)</label>
                  <input className="form-input" value={traveler.phone} onChange={(e) => updateTraveler(index, "phone", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (optional)</label>
                  <input type="email" className="form-input" value={traveler.email} onChange={(e) => updateTraveler(index, "email", e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-outline" onClick={addTraveler}>
            + Add Another Traveler
          </button>
        </div>

        <aside className="card create-booking__summary">
          <h3>Price Summary</h3>
          <div className="create-booking__summary-row">
            <span>{formatCurrency(effectivePrice)} &times; {travelers.length}</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="create-booking__summary-total">
            <span>Total</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <p className="create-booking__summary-note">
            Final price is always calculated on the server at booking time.
          </p>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </aside>
      </form>
    </div>
  );
}
