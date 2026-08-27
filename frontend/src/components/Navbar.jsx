import { Link, NavLink, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./Navbar.css";

export default function Navbar() {
  const { isAuthenticated, isStaffOrAdmin, user, logout } = useAuth();
  const location = useLocation();
  const isTransparent =
    location.pathname === "/" ||
    location.pathname.startsWith("/destinations") ||
    location.pathname.startsWith("/packages") ||
    location.pathname === "/contact";

  return (
    <header className={`navbar ${isTransparent ? 'navbar--transparent' : ''}`}>
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand">
          Travel<span>Booking</span>
        </Link>

        <nav className="navbar__links">
          <NavLink to="/" className="navbar__link">
            Home
          </NavLink>
          <NavLink to="/destinations" className="navbar__link">
            Destinations
          </NavLink>
          <NavLink to="/packages" className="navbar__link">
            Trips
          </NavLink>
          <NavLink to="/contact" className="navbar__link">
            Contact
          </NavLink>
        </nav>

        <div className="navbar__actions">
          {isAuthenticated ? (
            <>
              {isStaffOrAdmin && (
                <Link to="/admin" className="btn navbar__btn-admin">
                  Admin
                </Link>
              )}
              <Link to="/my-bookings" className="navbar__link">
                My Bookings
              </Link>
              <Link to="/profile" className="navbar__link">
                {user?.username || "Profile"}
              </Link>
              <button className="btn navbar__btn-logout" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar__link">
                Login
              </Link>
              <Link to="/register" className="btn navbar__btn-signup">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
