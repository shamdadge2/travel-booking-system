import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import destinationApi from "../../api/destinationApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { name: "", city: "", state: "", country: "", description: "", is_featured: false };

export default function AdminDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    destinationApi
      .list({ page_size: 100 })
      .then((data) => setDestinations(data.results))
      .catch(() => setError("Couldn't load destinations."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const startCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setImageFile(null);
    setImagePreview("");
    setImageUploadError("");
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
      is_featured: destination.is_featured || false,
    });
    setImageFile(null);
    setImagePreview(destination.image || "");
    setImageUploadError("");
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setImageUploadError("");
    setSaving(true);
    try {
      let savedId = editingId;
      if (editingId) {
        await destinationApi.update(editingId, formData);
        savedId = editingId;
      } else {
        const created = await destinationApi.create(formData);
        savedId = created.id;
      }
      if (imageFile && savedId) {
        const fd = new FormData();
        fd.append("image", imageFile);
        try {
          await destinationApi.update(savedId, fd);
        } catch (imgErr) {
          const d = imgErr.response?.data;
          const m = d && typeof d === "object" ? Object.values(d)[0] : null;
          setImageUploadError((Array.isArray(m) ? m[0] : m) || "Destination saved but image upload failed — try editing and re-uploading.");
        }
      }
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setEditingId(null);
      setImageFile(null);
      setImagePreview("");
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

          <div className="form-group">
            <label className="form-label">
              <input type="checkbox" name="is_featured" checked={formData.is_featured} onChange={handleChange} style={{ marginRight: 8 }} />
              Featured on Homepage
            </label>
            <p className="admin-form__note">If checked, this destination appears on the homepage “Explore Popular Destinations” section. Otherwise it only shows on the All Destinations page.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Featured Image (shown on destination cards &amp; hero)</label>
            {imagePreview && !imageFile && (
              <div style={{ marginBottom: 8 }}>
                <img src={imagePreview} alt="Current" style={{ maxWidth: 240, maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <p className="admin-form__note" style={{ marginTop: 4 }}>Current image — choose a new file below to replace it.</p>
              </div>
            )}
            {imageFile && (
              <div style={{ marginBottom: 8 }}>
                <p className="admin-form__note">New file selected: <strong>{imageFile.name}</strong> — will upload on Save/Update.</p>
                <img src={URL.createObjectURL(imageFile)} alt="New preview" style={{ maxWidth: 240, maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
              </div>
            )}
            {imageUploadError && <p className="form-error">{imageUploadError}</p>}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files[0] || null;
                setImageFile(f);
                setImageUploadError("");
              }}
            />
            <p className="admin-form__note">JPG / PNG / WebP recommended. This image is what users see on the destination listing.</p>
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
                  <th>Image</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((destination) => (
                  <tr key={destination.id}>
                    <td>{destination.id}</td>
                    <td>
                      {destination.image ? (
                        <img src={destination.image} alt={destination.name} style={{ width: 56, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>—</span>
                      )}
                    </td>
                    <td>{destination.name}</td>
                    <td>{destination.city}</td>
                    <td>{destination.country}</td>
                    <td>
                      <span className={`badge ${destination.is_active ? "badge-success" : "badge-danger"}`}>
                        {destination.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{destination.is_featured ? "★ Featured" : "—"}</td>
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
