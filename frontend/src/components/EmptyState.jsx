import "./EmptyState.css";

export default function EmptyState({
  title = "Nothing here yet",
  message = "",
  actionLabel,
  onAction,
  tone = "default",
}) {
  return (
    <div className={`empty-state empty-state--${tone}`}>
      <h3 className="empty-state__title">{title}</h3>
      {message && <p className="empty-state__message">{message}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
