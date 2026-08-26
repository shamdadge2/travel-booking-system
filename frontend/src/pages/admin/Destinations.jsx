import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import destinationApi from "../../api/destinationApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { name: "", city: "", state: "", country: "", description: "" };

export default function AdminDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    // As a staff/admin request (JWT attached via axios interceptor),
    // the backend returns both active and inactive destinations when
    // no is_active filter is passed — see destinations/views.py.
    destinationApi
      .list({ page_size: 100 })
      .then((data) => setDestinations(data.results))
      .catch(() => setError("Couldn't load destinations."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const startCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const startEdit = (destination) => {
    setEditingId(destination.id);
    setFormData({
      name: destination.name,
      city: destination.city,
      state: destination.state || "",
      country: destination.country,
      description: destination.description || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editingId) {
        await destinationApi.update(editingId, formData);
      } else {
        await destinationApi.create(formData);
      }
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err) {
      const data = err.response?.data;
      const message = data && typeof data === "object" ? Object.values(data)[0] : null;
      setFormError((Array.isArray(message) ? message[0] : message) || "Couldn't save destination.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (destination) => {
    setError("");
    try {
      await destinationApi.remove(destination.id);
      setDestinations(destinations.filter((d) => d.id !== destination.id));
    } catch (err) {
      // Backend returns a 409 with a helpful message when the
      // destination still has packages pointing at it (PROTECT).
      setError(err.response?.data?.detail || "Couldn't delete this destination.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Destinations</h1>
          <p>Manage travel destinations</p>
        </div>
        <button className="btn btn-primary" onClick={showForm ? () => setShowForm(false) : startCreate}>
          {showForm ? "Cancel" : "+ Add Destination"}
        </button>
      </div>

      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input name="name" className="form-input" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input name="city" className="form-input" value={formData.city} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">State</label>
              <input name="state" className="form-input" value={formData.state} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input name="country" className="form-input" value={formData.country} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea name="description" rows="3" className="form-textarea" value={formData.description} onChange={handleChange} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Destination" : "Save Destination"}
          </button>
        </form>
      )}

      {isLoading ? (
        <Loader label="Loading destinations..." />
      ) : error && destinations.length === 0 ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : (
        <>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((destination) => (
                  <tr key={destination.id}>
                    <td>{destination.id}</td>
                    <td>{destination.name}</td>
                    <td>{destination.city}</td>
                    <td>{destination.country}</td>
                    <td>
                      <span className={`badge ${destination.is_active ? "badge-success" : "badge-danger"}`}>
                        {destination.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="admin-table__actions">
                      <button onClick={() => startEdit(destination)}>Edit</button>
                      <button className="danger" onClick={() => handleDelete(destination)}>Delete</button>
                    </td>
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
