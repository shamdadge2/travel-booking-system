import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./Navbar.css";

export default function Navbar() {
  const { isAuthenticated, isStaffOrAdmin, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar navbar--transparent">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand" onClick={close}>
          Travel<span>Booking</span>
        </Link>

        <nav className={`navbar__links ${open ? "navbar__links--open" : ""}`}>
          <NavLink to="/" className="navbar__link" onClick={close}>Home</NavLink>
          <NavLink to="/destinations" className="navbar__link" onClick={close}>Destinations</NavLink>
          <NavLink to="/packages" className="navbar__link" onClick={close}>Trips</NavLink>
          <NavLink to="/contact" className="navbar__link" onClick={close}>Contact</NavLink>
        </nav>

        <div className={`navbar__actions ${open ? "navbar__actions--open" : ""}`}>
          {isAuthenticated ? (
            <>
              {isStaffOrAdmin && (
                <Link to="/admin" className="btn navbar__btn-admin" onClick={close}>Admin</Link>
              )}
              <Link to="/my-bookings" className="navbar__link" onClick={close}>My Bookings</Link>
              <Link to="/profile" className="navbar__link" onClick={close}>{user?.username || "Profile"}</Link>
              <button className="btn navbar__btn-logout" onClick={() => { close(); logout(); }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar__link" onClick={close}>Login</Link>
              <Link to="/register" className="btn navbar__btn-signup" onClick={close}>Sign Up</Link>
            </>
          )}
        </div>

        <button
          className={`navbar__toggle ${open ? "navbar__toggle--open" : ""}`}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && <button className="navbar__backdrop" aria-label="Close menu" onClick={close} />}
    </header>
  );
}
