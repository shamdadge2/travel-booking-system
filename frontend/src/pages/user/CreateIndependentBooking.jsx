import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import bookingApi from "../../api/bookingApi";
import "./CreateBooking.css";

const EMPTY_TRAVELER = { full_name: "", age: "", gender: "male", phone: "", email: "", nationality: "", govt_id: "", emergency_contact_name: "", emergency_contact_phone: "" };

export default function CreateIndependentBooking() {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get("package");
  const navigate = useNavigate();

  const [pkg, setPkg] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState([{ ...EMPTY_TRAVELER }]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [price, setPrice] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponValid, setCouponValid] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    if (!packageId) {
      setLoadError("No package selected. Please go back and choose a package.");
      setIsLoading(false);
      return;
    }
    packageApi.get(packageId).then((data) => {
      if (data.trip_type !== "independent_package") {
        setLoadError("This package is a Group Tour. Use the Group Tour booking flow.");
        return;
      }
      setPkg(data);
      // default travel date to first available
      if (data.travel_dates && data.travel_dates.length > 0) {
        const firstAvail = data.travel_dates.find((d) => d.status === "available") || data.travel_dates[0];
        if (firstAvail && firstAvail.status !== "not_available") setTravelDate(firstAvail.travel_date);
      } else if (data.start_date) {
        setTravelDate(data.start_date);
      }
    }).catch(() => setLoadError("Couldn't load this package.")).finally(() => setIsLoading(false));
  }, [packageId]);

  // fetch price breakdown whenever travelers or coupon changes
  useEffect(() => {
    if (!pkg) return;
    const travelersCount = travelers.length;
    const params = { travelers: travelersCount };
    if (couponCode) params.coupon_code = couponCode;
    // Use POST for coupon calc; also handle date? price calc not date dependent
    packageApi.priceCalculate(pkg.id, { travelers: travelersCount, coupon_code: couponCode || undefined })
      .then((data) => {
        setPrice(data);
        setCouponError(data.coupon_valid === false ? data.coupon_message : "");
        setCouponValid(data.coupon_valid);
      })
      .catch(() => setPrice(null));
  }, [pkg, travelers.length, couponCode]);

  // check availability when date changes
  useEffect(() => {
    if (!pkg || !travelDate) return;
    packageApi.availability(pkg.id, travelers.length, travelDate)
      .then((data) => setAvailability(data))
      .catch(() => setAvailability(null));
  }, [pkg, travelDate, travelers.length]);

  if (isLoading) return <Loader label="Loading package..." />;
  if (loadError || !pkg) {
    return <div className="container"><EmptyState tone="error" title="Can't book right now" message={loadError} /></div>;
  }

  const updateTraveler = (index, field, value) => {
    const updated = [...travelers];
    updated[index] = { ...updated[index], [field]: value };
    setTravelers(updated);
  };
  const addTraveler = () => {
    if (travelers.length >= pkg.max_travelers) {
      setError(`Maximum ${pkg.max_travelers} travelers allowed.`);
      return;
    }
    if (travelers.length >= pkg.available_slots) {
      setError(`Only ${pkg.available_slots} slot(s) available.`);
      return;
    }
    setTravelers([...travelers, { ...EMPTY_TRAVELER }]);
  };
  const removeTraveler = (index) => {
    if (travelers.length === 1) return;
    setTravelers(travelers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!travelDate) {
      setError("Please select a travel date.");
      return;
    }
    if (travelers.some((t) => !t.full_name || !t.age)) {
      setError("Please fill full name and age for every traveler.");
      return;
    }
    if (availability && !availability.is_available) {
      setError("Selected date is not available. Please choose another date.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        package: pkg.id,
        travel_date: travelDate,
        number_of_travelers: travelers.length,
        special_requests: specialRequests,
        coupon_code: couponCode || undefined,
        travelers: travelers.map((t) => ({ ...t, age: Number(t.age) })),
      };
      const booking = await bookingApi.create(payload);
      navigate(`/my-bookings/${booking.id}`);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.detail || (data && typeof data === "object" ? Object.values(data).flat().join(" ") : null) || "Couldn't create booking.";
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const breakdown = price;
  const finalAmount = breakdown ? breakdown.final_amount : pkg.price_breakdown?.final_price;

  return (
    <div className="container create-booking">
      <div className="page-header">
        <h1>Book: {pkg.title} <span style={{ fontSize: "0.7em", background: "#0f7a6c", color: "#fff", padding: "4px 10px", borderRadius: 999, marginLeft: 8 }}>Independent Package</span></h1>
        <p><Link to={`/packages/${pkg.id}`}>← Back to details</Link> · {pkg.destination?.name} · {pkg.duration_days}D/{pkg.duration_nights}N</p>
      </div>

      {error && <p className="form-error create-booking__error">{error}</p>}

      <form onSubmit={handleSubmit} className="create-booking__grid">
        <div className="create-booking__main">
          {/* Travel Date */}
          <div className="card create-booking__section">
            <h3>1. Select Travel Date</h3>
            {pkg.travel_dates && pkg.travel_dates.length > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
                  {pkg.travel_dates.map((td) => (
                    <button
                      key={td.id}
                      type="button"
                      onClick={() => td.status !== "not_available" && setTravelDate(td.travel_date)}
                      disabled={td.status === "not_available"}
                      style={{
                        border: travelDate === td.travel_date ? "2px solid #0f7a6c" : "1px solid #e2e8f0",
                        background: td.status === "not_available" ? "#fef2f2" : td.status === "limited" ? "#fef3c7" : "#e6f5f2",
                        opacity: td.status === "not_available" ? 0.6 : 1,
                        borderRadius: 12,
                        padding: "10px 12px",
                        cursor: td.status === "not_available" ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{formatDate(td.travel_date)}</div>
                      <div style={{ fontSize: "0.78rem", textTransform: "capitalize" }}>
                        {td.status === "available" ? "✅ Available" : td.status === "limited" ? "⚠️ Limited" : "❌ Not Available"}
                      </div>
                      {td.available_slots != null && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{td.available_slots} slots</div>}
                    </button>
                  ))}
                </div>
                {travelDate && <p style={{ fontSize: "0.85rem", color: "#0f7a6c" }}>Selected: <strong>{formatDate(travelDate)}</strong></p>}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Or pick a custom date</label>
                  <input type="date" className="form-input" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">Travel Date</label>
                <input type="date" className="form-input" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} required />
                <p className="create-booking__fixed-note">Flexible dates — pick your preferred travel date.</p>
              </div>
            )}
            {availability && !availability.is_available && <p className="form-error">Selected date is not available for booking.</p>}
            {availability?.services_availability && availability.services_availability.some((s) => !s.is_available) && (
              <p className="form-error">Some required services are unavailable for this date — please contact support.</p>
            )}
          </div>

          {/* Number of travelers & Special Requests */}
          <div className="card create-booking__section">
            <h3>2. Number of Travelers & Requests</h3>
            <p style={{ fontSize: "0.88rem", color: "#64748b" }}>{travelers.length} traveler(s) · Max {pkg.max_travelers}, {pkg.available_slots} slots left</p>
            <div style={{ marginBottom: 12 }}>
              <button type="button" className="btn btn-outline" onClick={addTraveler} style={{ marginRight: 8 }}>+ Add Traveler</button>
              <span style={{ fontSize: "0.84rem", color: "#64748b" }}>All travelers must be listed.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Special Requests (optional)</label>
              <textarea rows="3" className="form-textarea" placeholder="Dietary, accessibility, etc." value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
            </div>
          </div>

          {/* Travelers */}
          {travelers.map((traveler, idx) => (
            <div key={idx} className="card create-booking__section">
              <div className="create-booking__traveler-header">
                <h3>Traveler {idx + 1}</h3>
                {travelers.length > 1 && <button type="button" className="create-booking__remove" onClick={() => removeTraveler(idx)}>Remove</button>}
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={traveler.full_name} onChange={(e) => updateTraveler(idx, "full_name", e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Age *</label><input type="number" min="0" className="form-input" value={traveler.age} onChange={(e) => updateTraveler(idx, "age", e.target.value)} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender</label><select className="form-select" value={traveler.gender} onChange={(e) => updateTraveler(idx, "gender", e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                <div className="form-group"><label className="form-label">Nationality</label><input className="form-input" value={traveler.nationality} onChange={(e) => updateTraveler(idx, "nationality", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={traveler.phone} onChange={(e) => updateTraveler(idx, "phone", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={traveler.email} onChange={(e) => updateTraveler(idx, "email", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Govt ID / Passport (if required)</label><input className="form-input" value={traveler.govt_id} onChange={(e) => updateTraveler(idx, "govt_id", e.target.value)} placeholder="Optional" /></div>
                <div className="form-group"><label className="form-label">Emergency Contact Name</label><input className="form-input" value={traveler.emergency_contact_name} onChange={(e) => updateTraveler(idx, "emergency_contact_name", e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Emergency Contact Phone</label><input className="form-input" value={traveler.emergency_contact_phone} onChange={(e) => updateTraveler(idx, "emergency_contact_phone", e.target.value)} /></div>
            </div>
          ))}

          {/* Review Services */}
          <div className="card create-booking__section">
            <h3>3. Review Included Services</h3>
            {pkg.price_breakdown ? (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                {pkg.price_breakdown.services.map((s) => (
                  <div key={s.service_name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem" }}>
                    <span>✅ {s.service_name} <small style={{ color: "#64748b" }}>×{s.quantity} · {s.service_type}</small></span>
                    <strong>{formatCurrency(s.total_price)}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc" }}><span>Service Cost</span><span>{formatCurrency(pkg.price_breakdown.service_cost)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc" }}><span>Service Fee</span><span>{formatCurrency(pkg.price_breakdown.service_fee)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#0f172a", color: "#fff", fontWeight: 800 }}><span>Package Total (per group)</span><span>{formatCurrency(pkg.price_breakdown.final_price)}</span></div>
              </div>
            ) : <p style={{ color: "#64748b" }}>No service breakdown available.</p>}
          </div>
        </div>

        <aside className="card create-booking__summary">
          <h3>Price Breakdown</h3>
          {breakdown ? (
            <>
              <div className="create-booking__summary-row"><span>Services × {breakdown.travelers}</span><span>{formatCurrency(breakdown.service_cost)}</span></div>
              <div className="create-booking__summary-row"><span>Service Fee</span><span>{formatCurrency(breakdown.service_fee)}</span></div>
              <div className="create-booking__summary-row"><span>Subtotal</span><span>{formatCurrency(breakdown.subtotal)}</span></div>
              {breakdown.discount && Number(breakdown.discount) > 0 && (
                <div className="create-booking__summary-row" style={{ color: "#0f7a6c" }}><span>Discount {couponCode && `(${couponCode})`}</span><span>-{formatCurrency(breakdown.discount)}</span></div>
              )}
              <div className="create-booking__summary-total"><span>Final Amount</span><span>{formatCurrency(breakdown.final_amount)}</span></div>
            </>
          ) : (
            <>
              <div className="create-booking__summary-row"><span>Per package</span><span>{formatCurrency(finalAmount)}</span></div>
              <div className="create-booking__summary-total"><span>Total</span><span>{formatCurrency(finalAmount * travelers.length)}</span></div>
            </>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Coupon Code</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" placeholder="Enter coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} style={{ textTransform: "uppercase" }} />
              {couponCode && <button type="button" className="btn btn-outline" onClick={() => setCouponCode("")} style={{ padding: "10px 12px" }}>Clear</button>}
            </div>
            {couponError && <p className="form-error" style={{ marginTop: 6 }}>{couponError}</p>}
            {couponValid && <p style={{ color: "#0f7a6c", fontSize: "0.82rem", marginTop: 6 }}>✓ Coupon applied</p>}
          </div>

          <p className="create-booking__summary-note">Price is computed server-side. Coupon validation happens at booking.</p>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Booking..." : `Pay ${breakdown ? formatCurrency(breakdown.final_amount) : formatCurrency(finalAmount)} & Confirm`}
          </button>
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 8, textAlign: "center" }}>Secure payment · Invoice will be generated</p>
        </aside>
      </form>
    </div>
  );
}
