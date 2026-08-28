import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import paymentApi from "../../api/paymentApi";
import "./AdminTable.css";
import "./AdminForm.css";

function statusBadgeClass(status) {
  if (status === "paid") return "badge-success";
  if (status === "failed") return "badge-danger";
  return "badge-warning";
}

function UpiSettingsPanel() {
  const [settings, setSettings] = useState({ upi_id: "", merchant_name: "", qr_image: "" });
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    paymentApi
      .getSettings()
      .then((data) => {
        setSettings(data);
        if (data.qr_image) setQrPreview(data.qr_image);
      })
      .catch(() => {}) // not configured yet — leave the form blank
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (event) => {
    setSettings({ ...settings, [event.target.name]: event.target.value });
    setSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      let payload;
      if (qrFile) {
        payload = new FormData();
        payload.append("upi_id", settings.upi_id);
        payload.append("merchant_name", settings.merchant_name);
        payload.append("qr_image", qrFile);
      } else {
        payload = { upi_id: settings.upi_id, merchant_name: settings.merchant_name };
      }
      const updated = await paymentApi.updateSettings(payload);
      setSettings(updated);
      if (updated.qr_image) setQrPreview(updated.qr_image);
      setQrFile(null);
      const fileInput = document.querySelector('input[name="qr_image"]');
      if (fileInput) fileInput.value = "";
      setSaved(true);
    } catch (err) {
      const d = err.response?.data;
      const msg = d ? (typeof d === "string" ? d : Object.values(d).flat().join(" ") || d.detail) : err.message;
      setError(msg || "Couldn't save UPI settings.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Loader label="Loading payment settings..." />;

  return (
    <form className="card admin-form" onSubmit={handleSubmit}>
      <h3>UPI Receiving Account</h3>
      <p className="admin-form__note">
        This is the account customers pay into. When a customer chooses UPI at checkout, their
        UPI app opens with this account and the booking amount pre-filled. Upload a QR code so customers can scan and pay instantly — booking stays <strong>pending</strong> until you verify and <strong>Mark Paid</strong> below.
      </p>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="badge badge-success" style={{ display: "inline-block", marginBottom: "var(--space-md)" }}>Saved.</p>}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">UPI ID</label>
          <input
            name="upi_id"
            className="form-input"
            placeholder="yourname@okhdfcbank"
            value={settings.upi_id}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Display Name (shown to customers)</label>
          <input
            name="merchant_name"
            className="form-input"
            placeholder="Travel Booking System"
            value={settings.merchant_name}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">QR Code Image (optional)</label>
        {qrPreview && !qrFile && (
          <div style={{ marginBottom: 10 }}>
            <img src={qrPreview} alt="Current QR" style={{ maxWidth: 160, borderRadius: 12, border: "1px solid #e2e8f0" }} />
            <p className="admin-form__note" style={{ marginTop: 6 }}>Current QR — choose a new file to replace it.</p>
          </div>
        )}
        {qrFile && (
          <div style={{ marginBottom: 10 }}>
            <p className="admin-form__note">New file: <strong>{qrFile.name}</strong></p>
            <img src={URL.createObjectURL(qrFile)} alt="New QR preview" style={{ maxWidth: 160, borderRadius: 12, border: "1px solid #e2e8f0" }} />
          </div>
        )}
        <input
          name="qr_image"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files[0] || null;
            setQrFile(f);
            setSaved(false);
            setError("");
          }}
        />
        <p className="admin-form__note">PNG/JPG of the UPI QR. Shows on the payment page alongside the UPI ID. Leave empty to auto-generate QR from the UPI link.</p>
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving..." : "Save UPI Settings"}
      </button>
    </form>
  );
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  const load = () => {
    setIsLoading(true);
    paymentApi
      .list({ page_size: 100 })
      .then((data) => setPayments(data.results))
      .catch(() => setError("Couldn't load payments."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const verify = async (payment, result) => {
    setActionError("");
    setActioningId(payment.id);
    try {
      const updated = await paymentApi.process(payment.id, { simulate_result: result });
      setPayments(payments.map((p) => (p.id === payment.id ? updated : p)));
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't update this payment.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Payments</h1>
          <p>Payment history across all bookings</p>
        </div>
      </div>

      <UpiSettingsPanel />

      {actionError && <p className="form-error">{actionError}</p>}

      {isLoading ? (
        <Loader label="Loading payments..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Booking</th>
                <th>Amount</th>
                <th>Method</th>
                <th>UTR / Reference</th>
                <th>Status</th>
                <th>Paid At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.transaction_id}</td>
                  <td>{payment.booking.booking_reference}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td style={{ textTransform: "uppercase" }}>{payment.payment_method}</td>
                  <td>{payment.reference_number || "—"}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(payment.payment_status)}`}>
                      {payment.payment_status}
                    </span>
                  </td>
                  <td>{payment.paid_at ? formatDate(payment.paid_at) : "—"}</td>
                  <td className="admin-table__actions">
                    {payment.payment_status === "pending" && (
                      <>
                        <button
                          onClick={() => verify(payment, "success")}
                          disabled={actioningId === payment.id}
                          title="Confirm only after checking the money actually arrived in your account"
                        >
                          {actioningId === payment.id ? "..." : "Mark Paid"}
                        </button>
                        <button
                          className="danger"
                          onClick={() => verify(payment, "failure")}
                          disabled={actioningId === payment.id}
                        >
                          Mark Failed
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
