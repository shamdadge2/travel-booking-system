import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import "./AdminTable.css";

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

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

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Bookings</h1>
          <p>All customer bookings</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
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
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Package</th>
                <th>Travel Date</th>
                <th>Amount</th>
                <th>Booking Status</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_reference}</td>
                  <td>{b.user_username}</td>
                  <td>{b.package.title}</td>
                  <td>{formatDate(b.travel_date)}</td>
                  <td>{formatCurrency(b.total_amount)}</td>
                  <td>
                    <select
                      className="form-select"
                      value={b.booking_status}
                      onChange={(e) => updateStatus(b, "booking_status", e.target.value)}
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
