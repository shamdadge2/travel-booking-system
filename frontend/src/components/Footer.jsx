import { Link } from "react-router-dom";
import SocialIcons from "./SocialIcons";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__col">
          <div className="footer__brand">
            Travel<span>Booking</span>
          </div>
          <p className="footer__tagline">
            Handpicked tour packages and unforgettable journeys, booked in minutes.
          </p>
        </div>

        <div className="footer__col">
          <h4>Explore</h4>
          <Link to="/destinations">Destinations</Link>
          <Link to="/packages">Packages</Link>
          <Link to="/faq">FAQ</Link>
        </div>

        <div className="footer__col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
        </div>

        <div className="footer__col">
          <h4>Account</h4>
          <Link to="/login">Login</Link>
          <Link to="/register">Sign Up</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} TravelBooking. All rights reserved.</span>
          <div className="footer__credit">
            <span className="footer__credit-label">Developed by <strong>Sham Dadge</strong></span>
            <SocialIcons variant="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
