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
  const [selectedMap, setSelectedMap] = useState({}); // option_group -> PackageService id
  const [hotelBudget, setHotelBudget] = useState("all"); // all | budget | standard | luxury

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
      // init selectedMap from default options
      if (data.price_breakdown?.option_groups) {
        const init = {};
        Object.entries(data.price_breakdown.option_groups).forEach(([group, opts]) => {
          const def = opts.find((o) => o.is_default_selected) || opts[0];
          if (def) init[group] = def.id;
        });
        setSelectedMap(init);
      }
      // default travel date to first available
      if (data.travel_dates && data.travel_dates.length > 0) {
        const firstAvail = data.travel_dates.find((d) => d.status === "available") || data.travel_dates[0];
        if (firstAvail && firstAvail.status !== "not_available") setTravelDate(firstAvail.travel_date);
      } else if (data.start_date) {
        setTravelDate(data.start_date);
      }
    }).catch(() => setLoadError("Couldn't load this package.")).finally(() => setIsLoading(false));
  }, [packageId]);

  // fetch price breakdown whenever travelers or coupon or selection changes
  useEffect(() => {
    if (!pkg) return;
    const travelersCount = travelers.length;
    const selectedIds = Object.values(selectedMap);
    packageApi.priceCalculate(pkg.id, { travelers: travelersCount, coupon_code: couponCode || undefined, selected_services: selectedIds.length ? selectedIds : undefined })
      .then((data) => {
        setPrice(data);
        setCouponError(data.coupon_valid === false ? data.coupon_message : "");
        setCouponValid(data.coupon_valid);
      })
      .catch(() => setPrice(null));
  }, [pkg, travelers.length, couponCode, selectedMap]);

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
    // validate selectable groups have selection
    const groups = pkg.price_breakdown?.option_groups || {};
    for (const grp of Object.keys(groups)) {
      if (!selectedMap[grp]) {
        setError(`Please select a ${grp.replace('_',' ')} option.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        package: pkg.id,
        travel_date: travelDate,
        number_of_travelers: travelers.length,
        special_requests: specialRequests,
        coupon_code: couponCode || undefined,
        selected_services: Object.values(selectedMap),
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

          {/* Choose Travel / Van */}
          {pkg.price_breakdown?.option_groups && (
            <>
              {pkg.price_breakdown.option_groups.transport && (
                <div className="card create-booking__section">
                  <h3>3. Choose Travel — How You’ll Reach Destination</h3>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 12 }}>Select one intercity option: Flight, Train or Bus.</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pkg.price_breakdown.option_groups.transport.map((opt) => (
                      <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 12, border: selectedMap.transport === opt.id ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: selectedMap.transport === opt.id ? "#e6f5f2" : "#fff", cursor: "pointer" }}>
                        <input type="radio" name="transport" checked={selectedMap.transport === opt.id} onChange={() => setSelectedMap({ ...selectedMap, transport: opt.id })} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{opt.service_name} <small style={{ color: "#0f7a6c", textTransform: "capitalize" }}>· {opt.service_category}</small></div>
                          <div style={{ fontSize: "0.84rem", color: "#475569" }}>{opt.description}</div>
                          {opt.extra_data?.vehicle && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Vehicle: {opt.extra_data.vehicle} {opt.extra_data.capacity ? `· ${opt.extra_data.capacity} seats` : ""}</div>}
                        </div>
                        <div style={{ fontWeight: 800, textAlign: "right" }}>{formatCurrency(opt.total_price)}<br /><small style={{ color: "#64748b", fontWeight: 400 }}>{formatCurrency(opt.price)} / person</small></div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {pkg.price_breakdown.option_groups.local_vehicle && (
                <div className="card create-booking__section">
                  <h3>4. Choose Local Vehicle — Van for Sightseeing</h3>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 12 }}>Private vehicle for daily transfers.</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pkg.price_breakdown.option_groups.local_vehicle.map((opt) => (
                      <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 12, border: selectedMap.local_vehicle === opt.id ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: selectedMap.local_vehicle === opt.id ? "#e6f5f2" : "#fff", cursor: "pointer" }}>
                        <input type="radio" name="local_vehicle" checked={selectedMap.local_vehicle === opt.id} onChange={() => setSelectedMap({ ...selectedMap, local_vehicle: opt.id })} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{opt.service_name}</div>
                          <div style={{ fontSize: "0.84rem", color: "#475569" }}>{opt.description}</div>
                          {opt.extra_data?.vehicle && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{opt.extra_data.vehicle} · {opt.extra_data.ac || ""} · {opt.extra_data.capacity} seats</div>}
                        </div>
                        <div style={{ fontWeight: 800 }}>{formatCurrency(opt.total_price)}</div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {pkg.price_breakdown.option_groups.hotel && (
                <div className="card create-booking__section">
                  <h3>5. Choose Hotel — By Budget</h3>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["all","budget","standard","luxury"].map((tier) => (
                      <button key={tier} type="button" onClick={() => setHotelBudget(tier)} style={{ padding: "6px 12px", borderRadius: 999, border: hotelBudget===tier ? "2px solid #0f7a6c" : "1px solid #e2e8f0", background: hotelBudget===tier ? "#0f7a6c" : "#fff", color: hotelBudget===tier ? "#fff" : "#334155", fontSize: "0.82rem", fontWeight: 600, textTransform: "capitalize" }}>{tier === "budget" ? "Budget (<₹9k)" : tier === "standard" ? "Standard (₹9k-15k)" : tier==="luxury" ? "Luxury (>₹15k)" : "All"}</button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pkg.price_breakdown.option_groups.hotel
                      .filter((opt) => {
                        const p = Number(opt.total_price);
                        if (hotelBudget==="budget") return p < 9000;
                        if (hotelBudget==="standard") return p >= 9000 && p <= 15000;
                        if (hotelBudget==="luxury") return p > 15000;
                        return true;
                      })
                      .map((opt) => (
                      <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 12, border: selectedMap.hotel === opt.id ? "2px solid #0f7a6c" : "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: selectedMap.hotel === opt.id ? "#e6f5f2" : "#fff", cursor: "pointer" }}>
                        <input type="radio" name="hotel" checked={selectedMap.hotel === opt.id} onChange={() => setSelectedMap({ ...selectedMap, hotel: opt.id })} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{opt.service_name} <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 999, background: Number(opt.total_price) > 15000 ? "#fee2e2" : Number(opt.total_price) > 9000 ? "#fef3c7" : "#dcfce7", color: Number(opt.total_price) > 15000 ? "#991b1b" : Number(opt.total_price) > 9000 ? "#92400e" : "#166534" }}>{Number(opt.total_price) > 15000 ? "Luxury" : Number(opt.total_price) > 9000 ? "Standard" : "Budget"}</span></div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{opt.extra_data?.stars ? `${opt.extra_data.stars}★ · ${opt.extra_data.room} · ${opt.location}` : opt.location} {opt.extra_data?.per_night ? `· ${formatCurrency(opt.extra_data.per_night)}/night` : ""}</div>
                          <div style={{ fontSize: "0.84rem", color: "#475569" }}>{opt.description}</div>
                        </div>
                        <div style={{ fontWeight: 800, textAlign: "right" }}>{formatCurrency(opt.total_price)}<br /><small style={{ color: "#64748b", fontWeight: 400 }}>for 4N</small></div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Review Services (fixed) */}
          <div className="card create-booking__section">
            <h3>6. Review Included Services (Fixed)</h3>
            {pkg.price_breakdown ? (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                {/* Fixed services = those not in selectable groups - show breakdown from price */}
                {price ? price.services?.filter((s)=>!s.is_user_selectable).map((s) => (
                  <div key={s.service_name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem" }}>
                    <span>✅ {s.service_name} <small style={{ color: "#64748b" }}>×{s.quantity} · {s.service_type}</small></span>
                    <strong>{formatCurrency(s.total_price)}</strong>
                  </div>
                )) : pkg.price_breakdown.services.filter((s)=>!s.is_user_selectable).map((s) => (
                  <div key={s.service_name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem" }}>
                    <span>✅ {s.service_name} <small style={{ color: "#64748b" }}>×{s.quantity} · {s.service_type}</small></span>
                    <strong>{formatCurrency(s.total_price)}</strong>
                  </div>
                ))}
                {/* Selected options summary */}
                {price && price.services?.filter((s)=>s.is_user_selectable).map((s) => (
                  <div key={"sel-"+s.service_name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.92rem", background: "#fefce8" }}>
                    <span>⭐ {s.service_name} <small style={{ color: "#92400e" }}>selected · {s.option_group}</small></span>
                    <strong>{formatCurrency(s.total_price)}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc" }}><span>Service Cost</span><span>{formatCurrency(price ? price.service_cost : pkg.price_breakdown.service_cost)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc" }}><span>Service Fee</span><span>{formatCurrency(price ? price.service_fee : pkg.price_breakdown.service_fee)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#0f172a", color: "#fff", fontWeight: 800 }}><span>Package Total (per group)</span><span>{formatCurrency(price ? price.subtotal : pkg.price_breakdown.final_price)}</span></div>
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
