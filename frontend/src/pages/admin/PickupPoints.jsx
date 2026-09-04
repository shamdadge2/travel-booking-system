import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import pickupPointApi from "../../api/pickupPointApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { city: "", name: "", address: "", latitude: "", longitude: "", is_active: true };

export default function AdminPickupPoints() {
  const [points, setPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    const params = { page_size: 100 };
    if (search) params.search = search;
    pickupPointApi.list(params).then((data) => setPoints(data.results || data)).catch(() => setError("Couldn't load pickup points.")).finally(() => setIsLoading(false));
  };

  useEffect(load, [search]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const startCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setFormData({ city: p.city, name: p.name, address: p.address || "", latitude: p.latitude || "", longitude: p.longitude || "", is_active: p.is_active });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        city: formData.city,
        name: formData.name,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        is_active: formData.is_active,
      };
      if (editingId) await pickupPointApi.update(editingId, payload);
      else await pickupPointApi.create(payload);
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      load();
    } catch (err) {
      const d = err.response?.data;
      const msg = d && typeof d === "object" ? Object.values(d).flat().join(" ") : null;
      setFormError(msg || "Couldn't save pickup point.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete pickup point ${p.city} - ${p.name}?`)) return;
    setError("");
    try {
      await pickupPointApi.remove(p.id);
      setPoints(points.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't delete. It may be assigned to packages.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Pickup Points</h1>
          <p>Big cities as pickup hubs for group tours — user gets nearest suggestion via location</p>
        </div>
        <button className="btn btn-primary" onClick={showForm ? () => setShowForm(false) : startCreate}>{showForm ? "Cancel" : "+ Add Pickup Point"}</button>
      </div>

      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City * (big city e.g. Mumbai)</label>
              <input name="city" className="form-input" value={formData.city} onChange={handleChange} required placeholder="e.g. Mumbai, Delhi, Pune" />
            </div>
            <div className="form-group">
              <label className="form-label">Pickup Location Name * (e.g. Dadar Station)</label>
              <input name="name" className="form-input" value={formData.name} onChange={handleChange} required placeholder="e.g. Dadar Station, Leh Airport" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address (optional)</label>
            <input name="address" className="form-input" value={formData.address} onChange={handleChange} placeholder="Full address" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input type="number" step="any" name="latitude" className="form-input" value={formData.latitude} onChange={handleChange} placeholder="19.0176" />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input type="number" step="any" name="longitude" className="form-input" value={formData.longitude} onChange={handleChange} placeholder="72.8562" />
            </div>
          </div>
          <p className="admin-form__note">Latitude/Longitude enables nearest suggestion via haversine. Find via Google Maps (right-click → coordinates). Leave blank if not needed — point will still show but without distance sorting.</p>
          <div className="form-group">
            <label className="form-label"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} style={{ marginRight: 8 }} />Active (visible to users)</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</button>
        </form>
      )}

      <div className="admin-toolbar">
        <input className="form-input" placeholder="Search city or name..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? <Loader label="Loading pickup points..." /> : error && points.length === 0 ? <EmptyState tone="error" title="Error" message={error} /> : (
        <>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>City</th><th>Name</th><th>Address</th><th>Coords</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.city}</td>
                    <td>{p.name}</td>
                    <td style={{ maxWidth: 220, fontSize: "0.85rem" }}>{p.address || "—"}</td>
                    <td style={{ fontSize: "0.8rem" }}>{p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : "—"}</td>
                    <td><span className={`badge ${p.is_active ? "badge-success" : "badge-warning"}`}>{p.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="admin-table__actions"><button onClick={() => startEdit(p)}>Edit</button><button className="danger" onClick={() => handleDelete(p)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
