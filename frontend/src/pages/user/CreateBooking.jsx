import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
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

  const [travelers, setTravelers] = useState([{ ...EMPTY_TRAVELER }]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pickup points for group tours
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState("");
  const [nearestPickup, setNearestPickup] = useState(null);
  const [locating, setLocating] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    if (!packageId) {
      setLoadError("No package was selected. Please go back and choose a package to book.");
      setIsLoading(false);
      return;
    }
    packageApi
      .get(packageId)
      .then((data) => {
        setPkg(data);
        // fetch pickup points for group tours
        if (data.trip_type === "group_tour" || data.pickup_points) {
          packageApi.pickupPoints(data.id).then((pp) => {
            setPickupPoints(pp.pickup_points || []);
            if (pp.nearest) setNearestPickup(pp.nearest);
          }).catch(() => {});
          // also preload from detail if available
          if (data.pickup_points && data.pickup_points.length) {
            setPickupPoints(data.pickup_points);
          }
        }
      })
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

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        packageApi.pickupPoints(pkg.id, { lat, lng }).then((pp) => {
          setPickupPoints(pp.pickup_points || []);
          if (pp.nearest) {
            setSelectedPickup(String(pp.nearest.id));
            setNearestPickup(pp.nearest);
          }
        }).catch(() => setError("Couldn't fetch nearest pickup points.")).finally(() => setLocating(false));
      },
      (err) => {
        setError("Location access denied: " + err.message);
        setLocating(false);
      }
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (travelers.some((t) => !t.full_name || !t.age)) {
      setError("Please fill in at least full name and age for every traveler.");
      return;
    }

    // Trip dates are fixed by the package — use start_date as travel_date.
    // If package has no fixed dates, fall back to today (backend validates not in past).
    const todayIso = new Date().toISOString().split("T")[0];
    const fixedTravelDate = pkg.start_date && pkg.start_date >= todayIso ? pkg.start_date : pkg.start_date || todayIso;

    setSubmitting(true);
    try {
      const payload = {
        package: pkg.id,
        travel_date: fixedTravelDate,
        number_of_travelers: travelers.length,
        special_requests: specialRequests,
        travelers: travelers.map((t) => ({ ...t, age: Number(t.age) })),
      };
      if (selectedPickup) payload.pickup_point = Number(selectedPickup);
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
            <div className="create-booking__fixed-dates">
              {pkg.start_date || pkg.end_date ? (
                <>
                  <div className="create-booking__date-row">
                    <span className="create-booking__date-icon">📅</span>
                    <div>
                      <div className="create-booking__date-value">
                        {pkg.start_date ? formatDate(pkg.start_date) : "—"} {pkg.end_date ? `— ${formatDate(pkg.end_date)}` : ""}
                      </div>
                      <div className="create-booking__date-meta">
                        {pkg.duration_days} Days / {pkg.duration_nights} Nights
                        {pkg.pickup_location ? ` · Pickup: ${pkg.pickup_location}` : ""}
                      </div>
                    </div>
                  </div>
                  <p className="create-booking__fixed-note">Dates are fixed by this package — no need to pick a date. Your booking will be for the dates above.</p>
                </>
              ) : (
                <>
                  <div className="create-booking__date-value">Flexible dates</div>
                  <p className="create-booking__fixed-note">This package has flexible dates — our team will confirm the exact departure after booking.</p>
                </>
              )}
            </div>
            {(pkg.trip_type === "group_tour" || pickupPoints.length > 0) && pickupPoints.length > 0 && (
              <div className="form-group" style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                <label className="form-label">Pickup Point — We bring you with us</label>
                <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 8px" }}>Choose your nearest city pickup point. Use your location to get suggestion.</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button type="button" className="btn btn-outline" onClick={handleUseLocation} disabled={locating} style={{ fontSize: "0.85rem" }}>
                    {locating ? "Locating..." : "📍 Use my location (Suggest nearest)"}
                  </button>
                  {userCoords && <span style={{ fontSize: "0.78rem", color: "#0f7a6c", alignSelf: "center" }}>Lat {userCoords.lat.toFixed(4)}, Lng {userCoords.lng.toFixed(4)}</span>}
                </div>
                {nearestPickup && (
                  <div style={{ background: "#e6f5f2", border: "1px solid #0f7a6c", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: "0.9rem" }}>
                    <strong>Nearest suggested:</strong> {nearestPickup.city} — {nearestPickup.name} {nearestPickup.distance_km ? `· ${nearestPickup.distance_km} km away` : ""} {nearestPickup.address ? `· ${nearestPickup.address}` : ""}
                  </div>
                )}
                <select className="form-select" value={selectedPickup} onChange={(e) => setSelectedPickup(e.target.value)}>
                  <option value="">Select pickup point (optional)</option>
                  {pickupPoints.map((pp) => (
                    <option key={pp.id} value={pp.id}>
                      {pp.city} — {pp.name} {pp.distance_km ? `(${pp.distance_km} km)` : ""} {pp.address ? `· ${pp.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {pkg.trip_type === "group_tour" && pickupPoints.length === 0 && pkg.pickup_location && (
              <div style={{ marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", fontSize: "0.88rem", color: "#475569" }}>
                <strong>Pickup:</strong> {pkg.pickup_location} — our team manages the trip from pickup point onwards.
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="special_requests">Special Requests (optional)</label>
              <textarea
                id="special_requests"
                rows="3"
                className="form-textarea"
                placeholder="Anything we should know? Dietary needs, accessibility, etc."
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
