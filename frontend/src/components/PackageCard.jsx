import { Link } from "react-router-dom";
import { formatCurrency } from "../utils/formatters";
import "./PackageCard.css";

/**
 * Displays one tour package as a card. Expects a package-shaped
 * object matching the API's list response (see packageApi.list).
 */
export default function PackageCard({ pkg }) {
  const {
    id,
    title,
    destination_name,
    duration_days,
    duration_nights,
    price,
    discount_price,
    is_discounted,
    package_type,
    featured_image,
  } = pkg;

  const effectivePrice = is_discounted ? discount_price : price;

  return (
    <Link to={`/packages/${id}`} className="package-card">
      <div className="package-card__image-wrap">
        {featured_image ? (
          <img src={featured_image} alt={title} className="package-card__image" />
        ) : (
          <div className="package-card__image package-card__image--placeholder">
            {title?.[0] || "T"}
          </div>
        )}
        {is_discounted && <span className="badge badge-accent package-card__badge">Sale</span>}
      </div>

      <div className="package-card__body">
        <span className="package-card__type">{package_type}</span>
        <h3 className="package-card__title">{title}</h3>
        <p className="package-card__meta">
          {destination_name} &middot; {duration_days}D/{duration_nights}N
        </p>

        <div className="package-card__price-row">
          <div>
            {is_discounted && (
              <span className="package-card__price-old">{formatCurrency(price)}</span>
            )}
            <span className="package-card__price">{formatCurrency(effectivePrice)}</span>
            <span className="package-card__price-unit"> / person</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
