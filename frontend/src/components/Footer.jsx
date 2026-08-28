import { Link } from "react-router-dom";
import SocialIcons from "./SocialIcons";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      {/* Top CTA strip */}
      <div className="footer__cta">
        <div className="container footer__cta-inner">
          <div className="footer__cta-text">
            <h3>Ready for your next adventure?</h3>
            <p>Discover handpicked Himalayan escapes, coastal retreats &amp; curated itineraries.</p>
          </div>
          <Link to="/packages" className="footer__cta-btn">
            Explore Trips <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <div className="container footer__inner">
        {/* Brand + contact */}
        <div className="footer__col footer__col--brand">
          <Link to="/" className="footer__brand">
            Travel<span>Booking</span>
          </Link>
          <p className="footer__tagline">
            Curated tour packages and unforgettable journeys across India — booked in minutes, remembered for a lifetime.
          </p>
          <ul className="footer__contact">
            <li>
              <span className="footer__contact-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6 12 13 22 6"/></svg>
              </span>
              <a href="mailto:shamdadge058@gmail.com">shamdadge058@gmail.com</a>
            </li>
            <li>
              <span className="footer__contact-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5.2 12a19.7 19.7 0 0 1-3.1-8.7A2 2 0 0 1 4 1h3a2 2 0 0 1 2 1.7c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8 8.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.85.58 2.8.7A2 2 0 0 1 22 16.9Z"/></svg>
              </span>
              <a href="tel:+919529232912">+91 95292 32912</a>
            </li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Explore</h4>
          <Link to="/destinations">Destinations</Link>
          <Link to="/packages">All Trips</Link>
          <Link to="/packages?featured=1">Featured Packages</Link>
        </div>

        <div className="footer__col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/faq">FAQ &amp; Support</Link>
        </div>

        <div className="footer__col">
          <h4>Account</h4>
          <Link to="/login">Login</Link>
          <Link to="/register">Create Account</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span className="footer__copy">
            © {new Date().getFullYear()} TravelBooking. All rights reserved.
          </span>
          <div className="footer__credit">
            <span className="footer__credit-label">Crafted by <strong>Sham Dadge</strong></span>
            <span className="footer__dot" aria-hidden>·</span>
            <SocialIcons variant="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
