import { Link } from "react-router-dom";
import "./DestinationCard.css";

export default function DestinationCard({ destination }) {
  const { id, name, city, state, country, image } = destination;

  return (
    <Link to={`/destinations/${id}`} className="destination-card">
      <div className="destination-card__image-wrap">
        {image ? (
          <img src={image} alt={name} className="destination-card__image" />
        ) : (
          <div className="destination-card__image destination-card__image--placeholder">
            {name?.[0] || "D"}
          </div>
        )}
      </div>
      <div className="destination-card__body">
        <h3 className="destination-card__title">{name}</h3>
        <p className="destination-card__meta">
          {[city, state, country].filter(Boolean).join(", ")}
        </p>
      </div>
    </Link>
  );
}
