import { useEffect, useRef, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import itineraryApi from "../../api/itineraryApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { day_number: "", title: "", location: "", meals: "", accommodation: "", description: "", activities: "" };

const ITINERARY_IMPORT_TEMPLATE = `{
  "day_number": 1,
  "title": "Arrival in Leh",
  "location": "Leh",
  "meals": "Dinner",
  "accommodation": "Hotel, Leh",
  "description": "Arrive at Leh airport and acclimatize.",
  "activities": "Airport pickup, evening market walk"
}
// Or paste an array to create multiple days at once:
[
  { "day_number": 1, "title": "Arrival", "location": "Leh" },
  { "day_number": 2, "title": "Leh to Nubra Valley", "location": "Nubra Valley", "meals": "Breakfast, Dinner" }
]`;

function ItineraryJsonImportPanel({ onImportSingle, onImportBulk, selectedPackageId }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const applyJson = async (jsonText) => {
    setError("");
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      setError("That doesn't look like valid JSON — check for missing commas/quotes and try again.");
      return;
    }
    if (Array.isArray(data)) {
      if (!selectedPackageId) {
        setError("Select a package first before bulk importing.");
        return;
      }
      if (data.length === 0) {
        setError("Array is empty.");
        return;
      }
      setImporting(true);
      let created = 0;
      let lastErr = "";
      for (const entry of data) {
        try {
          await itineraryApi.createForPackage(selectedPackageId, { ...entry, day_number: Number(entry.day_number) });
          created++;
        } catch (err) {
          const d = err.response?.data;
          const m = d && typeof d === "object" ? Object.values(d)[0] : null;
          lastErr = (Array.isArray(m) ? m[0] : m) || err.message || "Unknown error";
        }
      }
      setImporting(false);
      if (created > 0) {
        onImportBulk(created, lastErr);
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (lastErr && created < data.length) setError(`${created}/${data.length} days imported. Last error: ${lastErr}`);
      } else {
        setError(lastErr || "Couldn't import any days.");
      }
      return;
    }
    // Single object -> fill the form for review before saving.
    onImportSingle(data);
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => applyJson(e.target.result);
    reader.readAsText(file);
  };

  return (
    <div className="json-import">
      <div className="json-import__header">
        <h4>Import from JSON (optional)</h4>
        <button type="button" className="json-import__toggle" onClick={() => setShowTemplate(!showTemplate)}>
          {showTemplate ? "Hide" : "Show"} example format
        </button>
      </div>
      <p className="admin-form__note">
        Generate itinerary days with ChatGPT (or any AI tool) using the format below, then paste or upload the result here. For a single day it fills the form for you to review; for an array it creates all days at once for the selected package.
      </p>

      {showTemplate && <pre className="json-import__template">{ITINERARY_IMPORT_TEMPLATE}</pre>}

      {error && <p className="form-error">{error}</p>}

      <textarea
        className="form-textarea json-import__textarea"
        rows="4"
        placeholder="Paste JSON here... (single day object or array of days)"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="json-import__actions">
        <button type="button" className="btn btn-outline" onClick={() => applyJson(text)} disabled={!text.trim() || importing}>
          {importing ? "Importing..." : "Load Pasted JSON"}
        </button>
        <span className="json-import__or">or</span>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} disabled={importing} />
      </div>
    </div>
  );
}

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

      <ItineraryJsonImportPanel
        onImportSingle={(data) => {
          setFormData({
            day_number: data.day_number ?? "",
            title: data.title ?? "",
            location: data.location ?? "",
            meals: data.meals ?? "",
            accommodation: data.accommodation ?? "",
            description: data.description ?? "",
            activities: data.activities ?? "",
          });
          setEditingId(null);
          setFormError("");
          setShowForm(true);
        }}
        onImportBulk={(count) => {
          loadDays();
        }}
        selectedPackageId={selectedPackageId}
      />
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
