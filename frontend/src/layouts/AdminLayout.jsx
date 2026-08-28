import { NavLink, Outlet, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import useAuth from "../hooks/useAuth";
import "./AdminLayout.css";

const ADMIN_LINKS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/destinations", label: "Destinations" },
  { to: "/admin/packages", label: "Packages" },
  { to: "/admin/itineraries", label: "Itineraries" },
  { to: "/admin/bookings", label: "Bookings" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/reviews", label: "Reviews" },
  { to: "/admin/messages", label: "Messages" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <>
      <Navbar />
      <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-sidebar__brand">
          Travel<span>Booking</span>
        </Link>
        <p className="admin-sidebar__subtitle">Admin Panel</p>

        <nav className="admin-sidebar__nav">
          {ADMIN_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                "admin-sidebar__link" + (isActive ? " admin-sidebar__link--active" : "")
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <p>{user?.username || "Admin"}</p>
          <button className="btn btn-outline btn-block" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
    </>
  );
}
