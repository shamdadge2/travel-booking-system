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
    trip_type,
    trip_type_display,
    featured_image,
    computed_price,
    service_cost_total,
  } = pkg;

  const effectivePrice = is_discounted ? discount_price : price;
  const isIndependent = trip_type === "independent_package";
  const displayPrice = isIndependent && computed_price ? computed_price : effectivePrice;

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
        {is_discounted && !isIndependent && <span className="badge badge-accent package-card__badge">Sale</span>}
        {isIndependent ? (
          <span className="badge badge-success package-card__badge" style={{ background: "#0f7a6c", color: "#fff" }}>Independent</span>
        ) : (
          <span className="badge package-card__badge" style={{ background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>Group Tour</span>
        )}
      </div>

      <div className="package-card__body">
        <span className="package-card__type">
          {isIndependent ? "We Arrange Your Trip" : "Travel With Us"} · {package_type}
        </span>
        <h3 className="package-card__title">{title}</h3>
        <p className="package-card__meta">
          {destination_name} &middot; {duration_days}D/{duration_nights}N
          {isIndependent && service_cost_total ? ` · Services included` : ""}
        </p>
        {isIndependent && pkg.package_services && pkg.package_services.length > 0 ? (
          <p className="package-card__meta" style={{ fontSize: "0.74rem", marginTop: "-6px" }}>
            {pkg.package_services.slice(0, 3).map((ps) => ps.service?.name || ps.service_name).join(" + ")}{pkg.package_services.length > 3 ? " + more" : ""}
          </p>
        ) : null}

        <div className="package-card__price-row">
          <div>
            {is_discounted && !isIndependent && (
              <span className="package-card__price-old">{formatCurrency(price)}</span>
            )}
            <span className="package-card__price">{formatCurrency(displayPrice)}</span>
            <span className="package-card__price-unit"> {isIndependent ? "per package" : "/ person"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
