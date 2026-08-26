import { Link, NavLink } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./Navbar.css";

export default function Navbar() {
  const { isAuthenticated, isStaffOrAdmin, user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand">
          Travel<span>Booking</span>
        </Link>

        <nav className="navbar__links">
          <NavLink to="/destinations" className="navbar__link">
            Destinations
          </NavLink>
          <NavLink to="/packages" className="navbar__link">
            Packages
          </NavLink>
          <NavLink to="/about" className="navbar__link">
            About
          </NavLink>
          <NavLink to="/contact" className="navbar__link">
            Contact
          </NavLink>
        </nav>

        <div className="navbar__actions">
          {isAuthenticated ? (
            <>
              {isStaffOrAdmin && (
                <Link to="/admin" className="btn btn-outline navbar__btn">
                  Admin
                </Link>
              )}
              <Link to="/my-bookings" className="navbar__link">
                My Bookings
              </Link>
              <Link to="/profile" className="navbar__link">
                {user?.username || "Profile"}
              </Link>
              <button className="btn btn-outline navbar__btn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar__link">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary navbar__btn">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
