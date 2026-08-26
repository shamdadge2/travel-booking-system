import { useEffect, useState } from "react";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import bookingApi from "../../api/bookingApi";
import packageApi from "../../api/packageApi";
import authApi from "../../api/authApi";
import "./Dashboard.css";

// NOTE: there's no dedicated /api/admin/stats/ endpoint on the backend
// yet, so these numbers are computed client-side from the list
// endpoints (using a large page_size to approximate "all"). Fine at
// this scale; if the catalog grows large, a real aggregate endpoint
// would be worth adding to the bookings/packages apps.
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [popularPackages, setPopularPackages] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      bookingApi.list({ page_size: 100 }),
      packageApi.list({ page_size: 100 }),
      authApi.listUsers(),
    ])
      .then(([bookingsData, packagesData, usersData]) => {
        const bookings = bookingsData.results;
        const revenue = bookings
          .filter((b) => b.payment_status === "paid")
          .reduce((sum, b) => sum + Number(b.total_amount), 0);

        setStats([
          { label: "Total Users", value: String(usersData.length) },
          { label: "Total Packages", value: String(packagesData.count) },
          { label: "Total Bookings", value: String(bookingsData.count) },
          { label: "Revenue (Paid)", value: formatCurrency(revenue) },
        ]);

        setRecentBookings(bookings.slice(0, 5));

        const countByPackage = {};
        bookings.forEach((b) => {
          const title = b.package.title;
          countByPackage[title] = (countByPackage[title] || 0) + 1;
        });
        setPopularPackages(
          Object.entries(countByPackage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([title, count]) => ({ title, count }))
        );

        const statusCounts = {};
        bookings.forEach((b) => {
          statusCounts[b.booking_status] = (statusCounts[b.booking_status] || 0) + 1;
        });
        setStatusBreakdown(Object.entries(statusCounts));
      })
      .catch(() => setError("Couldn't load dashboard data."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loader label="Loading dashboard..." />;
  if (error) return <EmptyState tone="error" title="Something went wrong" message={error} />;

  return (
    <div className="admin-dashboard">
      <div className="admin-page__header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of platform activity</p>
        </div>
      </div>

      <div className="admin-dashboard__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="card admin-dashboard__stat">
            <span className="admin-dashboard__stat-value">{stat.value}</span>
            <span className="admin-dashboard__stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="admin-dashboard__grid">
        <div className="card admin-dashboard__panel">
          <h3>Recent Bookings</h3>
          {recentBookings.length === 0 ? (
            <p>No bookings yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Package</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.booking_reference}</td>
                    <td>{b.user_username}</td>
                    <td>{b.package.title}</td>
                    <td>{formatCurrency(b.total_amount)}</td>
                    <td>
                      <span className={`badge ${b.booking_status === "confirmed" ? "badge-success" : "badge-warning"}`}>
                        {b.booking_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card admin-dashboard__panel">
          <h3>Popular Packages</h3>
          {popularPackages.length === 0 ? (
            <p>No bookings yet.</p>
          ) : (
            <ul className="admin-dashboard__popular">
              {popularPackages.map((p) => (
                <li key={p.title}>
                  <span>{p.title}</span>
                  <span className="badge badge-accent">{p.count} bookings</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card admin-dashboard__panel">
          <h3>Booking Status Breakdown</h3>
          {statusBreakdown.length === 0 ? (
            <p>No bookings yet.</p>
          ) : (
            <ul className="admin-dashboard__popular">
              {statusBreakdown.map(([status, count]) => (
                <li key={status}>
                  <span style={{ textTransform: "capitalize" }}>{status}</span>
                  <span className="badge badge-success">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
