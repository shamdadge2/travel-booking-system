import SocialIcons from "../../components/SocialIcons";
import "./About.css";

export default function About() {
  return (
    <div className="container about-page">
      <div className="page-header">
        <h1>About TravelBooking</h1>
        <p>Making travel planning simple, transparent and affordable.</p>
      </div>

      <div className="about-page__content">
        <p>
          TravelBooking is a full-service tour package platform connecting travelers with
          handpicked destinations and complete, all-inclusive itineraries. From honeymoon
          escapes to high-altitude adventures, we design every package to remove the guesswork
          from planning a trip.
        </p>
        <p>
          Every package on our platform includes a detailed day-by-day itinerary, transparent
          pricing with no hidden fees, and a dedicated support team available before, during,
          and after your trip.
        </p>

        <div className="about-page__stats">
          <div className="about-page__stat">
            <strong>500+</strong>
            <span>Packages curated</span>
          </div>
          <div className="about-page__stat">
            <strong>50+</strong>
            <span>Destinations covered</span>
          </div>
          <div className="about-page__stat">
            <strong>10,000+</strong>
            <span>Happy travelers</span>
          </div>
        </div>

        <div className="about-page__developer card">
          <h2>Meet the Developer</h2>
          <p>
            This platform was designed and built by <strong>Sham Dadge</strong> — a full-stack
            developer focused on building clean, reliable web applications from the ground up.
          </p>
          <SocialIcons variant="light" />
        </div>
      </div>
    </div>
  );
}
