import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import itineraryApi from "../../api/itineraryApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { day_number: "", title: "", location: "", meals: "", accommodation: "", description: "", activities: "" };

export default function AdminItineraries() {
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [days, setDays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    packageApi.list({ page_size: 100 }).then((data) => {
      setPackages(data.results);
      if (data.results.length > 0) setSelectedPackageId(String(data.results[0].id));
    });
  }, []);

  const loadDays = () => {
    if (!selectedPackageId) return;
    setIsLoading(true);
    setError("");
    itineraryApi
      .listForPackage(selectedPackageId)
      .then((data) => setDays(data))
      .catch(() => setError("Couldn't load itinerary for this package."))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadDays, [selectedPackageId]);

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const startCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const startEdit = (day) => {
    setEditingId(day.id);
    setFormData({
      day_number: day.day_number,
      title: day.title,
      location: day.location || "",
      meals: day.meals || "",
      accommodation: day.accommodation || "",
      description: day.description || "",
      activities: day.activities || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = { ...formData, day_number: Number(formData.day_number) };
      if (editingId) {
        await itineraryApi.update(editingId, payload);
      } else {
        await itineraryApi.createForPackage(selectedPackageId, payload);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      loadDays();
    } catch (err) {
      const data = err.response?.data;
      const message = data && typeof data === "object" ? Object.values(data)[0] : null;
      setFormError((Array.isArray(message) ? message[0] : message) || "Couldn't save itinerary day.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (day) => {
    try {
      await itineraryApi.remove(day.id);
      setDays(days.filter((d) => d.id !== day.id));
    } catch {
      setError("Couldn't delete this itinerary day.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Itineraries</h1>
          <p>Manage day-by-day itinerary entries per package</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="form-select" value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value)}>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {selectedPackageId && (
          <button className="btn btn-primary" onClick={showForm ? () => setShowForm(false) : startCreate}>
            {showForm ? "Cancel" : "+ Add Day"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Day Number</label>
              <input type="number" min="1" name="day_number" className="form-input" value={formData.day_number} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input name="title" className="form-input" value={formData.title} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input name="location" className="form-input" value={formData.location} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Meals</label>
              <input name="meals" className="form-input" value={formData.meals} onChange={handleChange} placeholder="Breakfast, Lunch, Dinner" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Accommodation</label>
            <input name="accommodation" className="form-input" value={formData.accommodation} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Activities</label>
            <textarea name="activities" rows="2" className="form-textarea" value={formData.activities} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea name="description" rows="2" className="form-textarea" value={formData.description} onChange={handleChange} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Day" : "Save Day"}
          </button>
        </form>
      )}

      {isLoading ? (
        <Loader label="Loading itinerary..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : days.length === 0 ? (
        <EmptyState title="No itinerary days yet" message="Add the first day above." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Title</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.id}>
                  <td>Day {day.day_number}</td>
                  <td>{day.title}</td>
                  <td>{day.location}</td>
                  <td className="admin-table__actions">
                    <button onClick={() => startEdit(day)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(day)}>Delete</button>
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
