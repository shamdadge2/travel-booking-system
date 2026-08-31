import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import "./AdminTable.css";

const BOOKING_STATUSES = ["pending","payment_pending","confirmed","services_being_arranged","partially_confirmed","fully_confirmed","cancelled","completed","refund_processing","refunded"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "refund_processing"];

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = () => {
    setIsLoading(true);
    const params = { page_size: 100 };
    if (statusFilter) params.booking_status = statusFilter;
    bookingApi
      .list(params)
      .then((data) => setBookings(data.results))
      .catch(() => setError("Couldn't load bookings."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [statusFilter]);

  const updateStatus = async (booking, field, value) => {
    setActionError("");
    try {
      const updated = await bookingApi.update(booking.id, { [field]: value });
      setBookings(bookings.map((b) => (b.id === booking.id ? updated : b)));
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't update this booking.");
    }
  };

  const [selected, setSelected] = useState(null);
  const [detailServices, setDetailServices] = useState([]);
  const viewDetails = async (b) => {
    try {
      const data = await bookingApi.get(b.id);
      setSelected(data);
      setDetailServices(data.booking_services || []);
    } catch {}
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Bookings</h1>
          <p>All customer bookings — Group Tour & Independent Package</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}

      {isLoading ? (
        <Loader label="Loading bookings..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings found" />
      ) : (
        <>
          {selected && (
            <div className="card" style={{ padding: 16, marginBottom: 16, border: "1px solid #0f7a6c" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{selected.booking_reference} — {selected.package.title} <small style={{ background: selected.trip_type==="independent_package"?"#0f7a6c":"#e2e8f0", color: selected.trip_type==="independent_package"?"#fff":"#334155", padding: "2px 8px", borderRadius: 999, fontSize: "0.7rem" }}>{selected.trip_type==="independent_package"?"Independent":"Group"}</small></h3>
              <button className="btn btn-outline" onClick={()=>setSelected(null)}>Close</button>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Travel: {formatDate(selected.travel_date)} · {selected.number_of_travelers} travelers · {formatCurrency(selected.total_amount)} {selected.coupon_code ? `· Coupon ${selected.coupon_code} -${formatCurrency(selected.discount_amount)}` : ""}</p>
            {selected.travelers && <div style={{ marginBottom: 10 }}><strong>Travelers:</strong> {selected.travelers.map((t)=>t.full_name).join(", ")}</div>}
            {detailServices.length > 0 ? (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                {detailServices.map((s)=>(
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                    <span>{s.service_name} <small style={{ color: "#64748b" }}>· {s.service_type}</small></span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={s.status} onChange={async (e)=>{
                        try {
                          const updated = await bookingApi.updateBookingService(selected.id, s.id, { status: e.target.value });
                          setDetailServices(detailServices.map((x)=>x.id===s.id ? updated : x));
                        } catch {}
                      }} className="form-select" style={{ width: 140, fontSize: "0.82rem", padding: "4px 8px" }}>
                        <option value="pending">Pending</option><option value="processing">Processing</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
                      </select>
                      <span style={{ fontSize: "0.78rem", padding: "2px 6px", borderRadius: 999, background: s.status==="confirmed"?"#e6f5f2":"#fef3c7", color: s.status==="confirmed"?"#0f7a6c":"#92400e" }}>{s.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: "0.9rem", color: "#64748b" }}>No per-service breakdown (Group Tour).</p>}
          </div>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Package</th>
                <th>Type</th>
                <th>Travel Date</th>
                <th>Amount</th>
                <th>Booking Status</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_reference}</td>
                  <td>{b.user_username}</td>
                  <td>{b.package.title}</td>
                  <td><span className="badge" style={{ background: b.trip_type==="independent_package"?"#e6f5f2":"#f1f5f9", color: b.trip_type==="independent_package"?"#0f7a6c":"#475569" }}>{b.trip_type==="independent_package"?"Independent":"Group"}</span></td>
                  <td>{formatDate(b.travel_date)}</td>
                  <td>{formatCurrency(b.total_amount)}</td>
                  <td>
                    <select
                      className="form-select"
                      value={b.booking_status}
                      onChange={(e) => updateStatus(b, "booking_status", e.target.value)}
                      style={{ minWidth: 140, fontSize: "0.82rem" }}
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={b.payment_status}
                      onChange={(e) => updateStatus(b, "payment_status", e.target.value)}
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td><button className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "4px 8px" }} onClick={()=>viewDetails(b)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
