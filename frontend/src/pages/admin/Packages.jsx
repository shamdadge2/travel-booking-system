import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import packageApi from "../../api/packageApi";
import destinationApi from "../../api/destinationApi";
import serviceApi from "../../api/serviceApi";
import pickupPointApi from "../../api/pickupPointApi";
import "./AdminTable.css";
import "./AdminForm.css";

const PACKAGE_TYPES = ["adventure", "honeymoon", "family", "pilgrimage", "wildlife", "beach", "cultural", "luxury"];
const DIFFICULTIES = ["easy", "moderate", "difficult"];
const STATUSES = ["draft", "published", "inactive"];

const EMPTY_FORM = {
  title: "",
  destination: "",
  short_description: "",
  description: "",
  duration_days: "",
  duration_nights: "",
  price: "",
  discount_price: "",
  max_travelers: "",
  available_slots: "",
  package_type: "adventure",
  trip_type: "group_tour",
  difficulty: "easy",
  status: "draft",
  is_featured: false,
  start_date: "",
  end_date: "",
  pickup_location: "",
  service_fee: "0",
  best_time_to_visit: "",
  category: "",
  independent_highlights: "",
  travel_requirements: "",
  flexibility_note: "",
};

// Accepts either ["item text", ...] or [{item: "text"}, ...] — ChatGPT
// (or a person typing JSON by hand) is more likely to produce the
// first, simpler shape, so we normalize both into what the form state
// (and the backend's nested write serializer) expects.
function normalizeSimpleList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === "string" ? { item: entry } : { item: entry.item || "" }));
}

function normalizeActivities(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    title: entry.title || "",
    day_number: entry.day_number || entry.day || "",
    duration: entry.duration || "",
    description: entry.description || "",
  }));
}

function normalizeFaqs(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    question: entry.question || "",
    answer: entry.answer || "",
  }));
}

const IMPORT_TEMPLATE = `{
  "title": "Ladakh Bike Expedition",
  "short_description": "A short one-line summary",
  "description": "A longer paragraph describing the trip",
  "duration_days": 7,
  "duration_nights": 6,
  "price": 35000,
  "discount_price": null,
  "max_travelers": 12,
  "available_slots": 12,
  "package_type": "adventure",
  "difficulty": "moderate",
  "start_date": "2026-09-10",
  "end_date": "2026-09-16",
  "pickup_location": "Leh Airport",
  "inclusions": ["Fuel", "Backup vehicle", "Daily breakfast"],
  "exclusions": ["Flights", "Personal expenses"],
  "activities": [
    { "day_number": 2, "title": "River rafting", "duration": "2 hours" }
  ],
  "faqs": [
    { "question": "Do I need a bike license?", "answer": "Yes, a valid license is required." }
  ]
}`;

function JsonImportPanel({ onImport }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const applyJson = (jsonText) => {
    setError("");
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      setError("That doesn't look like valid JSON — check for missing commas/quotes and try again.");
      return;
    }
    onImport(data);
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
        Generate the details for this package with ChatGPT (or any AI tool) using the format
        below, then paste or upload the result here to fill in the form instead of typing every
        field — you can still review and edit anything afterward, or skip this entirely and fill
        the form in by hand.
      </p>

      {showTemplate && <pre className="json-import__template">{IMPORT_TEMPLATE}</pre>}

      {error && <p className="form-error">{error}</p>}

      <textarea
        className="form-textarea json-import__textarea"
        rows="4"
        placeholder="Paste JSON here..."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="json-import__actions">
        <button type="button" className="btn btn-outline" onClick={() => applyJson(text)} disabled={!text.trim()}>
          Load Pasted JSON
        </button>
        <span className="json-import__or">or</span>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} />
      </div>
    </div>
  );
}

// --- small reusable list editors for inclusions/exclusions ---
function SimpleListEditor({ label, items, onChange }) {
  const addItem = () => onChange([...items, { item: "" }]);
  const updateItem = (i, value) => {
    const copy = [...items];
    copy[i] = { ...copy[i], item: value };
    onChange(copy);
  };
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {items.map((entry, i) => (
        <div key={i} className="admin-list-row">
          <input
            className="form-input"
            value={entry.item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={`e.g. ${label === "Inclusions" ? "Daily breakfast" : "Personal expenses"}`}
          />
          <button type="button" className="admin-list-row__remove" onClick={() => removeItem(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-list-row__add" onClick={addItem}>
        + Add {label.slice(0, -1)}
      </button>
    </div>
  );
}

function ActivitiesEditor({ activities, onChange }) {
  const addItem = () => onChange([...activities, { title: "", day_number: "", duration: "", description: "" }]);
  const updateItem = (i, field, value) => {
    const copy = [...activities];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  };
  const removeItem = (i) => onChange(activities.filter((_, idx) => idx !== i));

  return (
    <div className="form-group">
      <label className="form-label">Activities</label>
      {activities.map((entry, i) => (
        <div key={i} className="admin-list-row admin-list-row--activity">
          <input className="form-input" style={{ maxWidth: 70 }} type="number" min="1" placeholder="Day" value={entry.day_number} onChange={(e) => updateItem(i, "day_number", e.target.value)} />
          <input className="form-input" placeholder="Activity title" value={entry.title} onChange={(e) => updateItem(i, "title", e.target.value)} />
          <input className="form-input" style={{ maxWidth: 120 }} placeholder="Duration" value={entry.duration} onChange={(e) => updateItem(i, "duration", e.target.value)} />
          <button type="button" className="admin-list-row__remove" onClick={() => removeItem(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-list-row__add" onClick={addItem}>+ Add Activity</button>
    </div>
  );
}

function FaqsEditor({ faqs, onChange }) {
  const addItem = () => onChange([...faqs, { question: "", answer: "" }]);
  const updateItem = (i, field, value) => {
    const copy = [...faqs];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  };
  const removeItem = (i) => onChange(faqs.filter((_, idx) => idx !== i));

  return (
    <div className="form-group">
      <label className="form-label">FAQs</label>
      {faqs.map((entry, i) => (
        <div key={i} className="admin-list-row admin-list-row--faq">
          <input className="form-input" placeholder="Question" value={entry.question} onChange={(e) => updateItem(i, "question", e.target.value)} />
          <input className="form-input" placeholder="Answer" value={entry.answer} onChange={(e) => updateItem(i, "answer", e.target.value)} />
          <button type="button" className="admin-list-row__remove" onClick={() => removeItem(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline admin-list-row__add" onClick={addItem}>+ Add FAQ</button>
    </div>
  );
}

function ImagesManager({ pkgId, images, onChange }) {
  const [file, setFile] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("place_name", placeName);
      formData.append("caption", caption);
      const created = await packageApi.addImage(pkgId, formData);
      onChange([...images, created]);
      setFile(null);
      setPlaceName("");
      setCaption("");
      // Clear the file input (uncontrolled) so the same file can be selected again
      const fileInput = document.querySelector(".admin-image-upload input[type='file']");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      const d = err.response?.data;
      const msg = d ? (typeof d === "string" ? d : Object.values(d).flat().join(" ") || JSON.stringify(d)) : err.message;
      setError(msg || "Couldn't upload this image.");
      console.error("addImage failed", d || err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (imageId) => {
    try {
      await packageApi.removeImage(imageId);
      onChange(images.filter((img) => img.id !== imageId));
    } catch (err) {
      const d = err.response?.data;
      const msg = d ? (typeof d === "string" ? d : Object.values(d).flat().join(" ") || JSON.stringify(d)) : err.message;
      setError(msg || "Couldn't remove this image.");
      console.error("removeImage failed", d || err);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">Places Gallery (photo + place name + short description)</label>
      {error && <p className="form-error">{error}</p>}

      {images.length > 0 && (
        <div className="admin-images-grid">
          {images.map((img) => (
            <div key={img.id} className="admin-images-grid__item">
              <img src={img.image} alt={img.place_name || "package"} />
              <div className="admin-images-grid__caption">
                <strong>{img.place_name || "(no name)"}</strong>
                <p>{img.caption}</p>
              </div>
              <button type="button" className="admin-list-row__remove" onClick={() => handleRemove(img.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="admin-image-upload">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
        <input className="form-input" placeholder="Place name (e.g. Nubra Valley)" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
        <input className="form-input" placeholder="Short description" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <button type="button" className="btn btn-outline" disabled={uploading} onClick={handleUpload}>
          {uploading ? "Uploading..." : "+ Add Photo"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [inclusions, setInclusions] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [images, setImages] = useState([]);
  const [featuredFile, setFeaturedFile] = useState(null);
  const [featuredPreview, setFeaturedPreview] = useState("");
  const [featuredUploadError, setFeaturedUploadError] = useState("");
  const [saving, setSaving] = useState(false);

  // Independent package extra
  const [allServices, setAllServices] = useState([]);
  const [pkgServices, setPkgServices] = useState([]);
  const [travelDates, setTravelDates] = useState([]);
  const [newTravelDate, setNewTravelDate] = useState({ travel_date: "", status: "available", available_slots: "" });
  const [newService, setNewService] = useState({ service: "", quantity: 1, unit_price: "", is_included: true, is_user_selectable: false, option_group: "", is_default_selected: false });
  const [allPickupPoints, setAllPickupPoints] = useState([]);
  const [selectedPickupIds, setSelectedPickupIds] = useState([]);

  const load = () => {
    setIsLoading(true);
    const params = { page_size: 100 };
    if (search) params.search = search;
    packageApi
      .list(params)
      .then((data) => setPackages(data.results))
      .catch(() => setError("Couldn't load packages."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    destinationApi.list({ page_size: 100 }).then((data) => setDestinations(data.results));
    serviceApi.list({ page_size: 100 }).then((data) => setAllServices(data.results || data)).catch(() => {});
    pickupPointApi.list({ page_size: 100 }).then((data) => setAllPickupPoints(data.results || data)).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  // Merges only the fields actually present in the imported JSON into
  // the current form state — destination and status/featured stay
  // whatever the admin already picked, since an AI tool generating
  // package copy has no way to know your destination IDs or intended
  // publish status.
  const handleJsonImport = (data) => {
    const TEXT_FIELDS = [
      "title", "short_description", "description",
      "duration_days", "duration_nights", "price", "discount_price",
      "max_travelers", "available_slots", "package_type", "trip_type", "difficulty",
      "start_date", "end_date", "pickup_location", "service_fee", "best_time_to_visit", "category",
      "independent_highlights", "travel_requirements", "flexibility_note",
    ];
    const updates = {};
    TEXT_FIELDS.forEach((field) => {
      if (data[field] !== undefined && data[field] !== null) {
        updates[field] = data[field];
      }
    });
    setFormData((prev) => ({ ...prev, ...updates }));

    if (data.inclusions) setInclusions(normalizeSimpleList(data.inclusions));
    if (data.exclusions) setExclusions(normalizeSimpleList(data.exclusions));
    if (data.activities) setActivities(normalizeActivities(data.activities));
    if (data.faqs) setFaqs(normalizeFaqs(data.faqs));
  };

  const startCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setInclusions([]);
    setExclusions([]);
    setActivities([]);
    setFaqs([]);
    setImages([]);
    setPkgServices([]);
    setTravelDates([]);
    setSelectedPickupIds([]);
    setFeaturedFile(null);
    setFeaturedPreview("");
    setFeaturedUploadError("");
    setFormError("");
    setShowForm(true);
  };

  const startEdit = async (pkg) => {
    setEditingId(pkg.id);
    setFormError("");
    // The list endpoint doesn't include nested data — fetch the full detail.
    const full = await packageApi.get(pkg.id);
    setFormData({
      title: full.title,
      destination: full.destination.id,
      short_description: full.short_description || "",
      description: full.description || "",
      duration_days: full.duration_days,
      duration_nights: full.duration_nights,
      price: full.price,
      discount_price: full.discount_price || "",
      max_travelers: full.max_travelers,
      available_slots: full.available_slots,
      package_type: full.package_type,
      trip_type: full.trip_type || "group_tour",
      difficulty: full.difficulty,
      status: full.status,
      is_featured: full.is_featured,
      start_date: full.start_date || "",
      end_date: full.end_date || "",
      pickup_location: full.pickup_location || "",
      service_fee: full.service_fee || "0",
      best_time_to_visit: full.best_time_to_visit || "",
      category: full.category || "",
      independent_highlights: full.independent_highlights || "",
      travel_requirements: full.travel_requirements || "",
      flexibility_note: full.flexibility_note || "",
    });
    setInclusions(full.inclusions.map((i) => ({ item: i.item })));
    setExclusions(full.exclusions.map((e) => ({ item: e.item })));
    setActivities(full.activities.map((a) => ({ title: a.title, day_number: a.day_number, duration: a.duration || "", description: a.description || "" })));
    setFaqs(full.faqs.map((f) => ({ question: f.question, answer: f.answer })));
    setImages(full.images);
    setPkgServices(full.package_services || []);
    setTravelDates(full.travel_dates || []);
    setSelectedPickupIds((full.pickup_points || []).map((p) => p.id));
    setFeaturedFile(null);
    setFeaturedPreview(full.featured_image || "");
    setFeaturedUploadError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFeaturedUploadError("");
    setSaving(true);
    try {
      const payload = {
        ...formData,
        discount_price: formData.discount_price || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        inclusions: inclusions.filter((i) => i.item.trim()),
        exclusions: exclusions.filter((e) => e.item.trim()),
        activities: activities
          .filter((a) => a.title.trim())
          .map((a) => ({ ...a, day_number: Number(a.day_number) || 1 })),
        faqs: faqs.filter((f) => f.question.trim()),
        pickup_points: selectedPickupIds,
      };
      let savedId = editingId;
      let savedPkg = null;
      if (editingId) {
        savedPkg = await packageApi.update(editingId, payload);
        savedId = editingId;
      } else {
        savedPkg = await packageApi.create(payload);
        savedId = savedPkg.id;
      }
      // Featured image is uploaded separately via multipart PATCH because the main payload is JSON.
      // This matches how Django admin handles it and keeps Cloudinary uploads working.
      if (featuredFile && savedId) {
        const fd = new FormData();
        fd.append("featured_image", featuredFile);
        try {
          await packageApi.update(savedId, fd);
        } catch (imgErr) {
          const d = imgErr.response?.data;
          const m = d && typeof d === "object" ? Object.values(d)[0] : null;
          setFeaturedUploadError((Array.isArray(m) ? m[0] : m) || "Package saved but featured image upload failed — try editing and re-uploading.");
          // Don't block closing the form; the package itself was saved.
        }
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      setFeaturedFile(null);
      setFeaturedPreview("");
      load();
    } catch (err) {
      const data = err.response?.data;
      const message = data && typeof data === "object" ? Object.values(data)[0] : null;
      setFormError((Array.isArray(message) ? message[0] : message) || "Couldn't save package.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg) => {
    setError("");
    try {
      await packageApi.remove(pkg.id);
      setPackages(packages.filter((p) => p.id !== pkg.id));
    } catch (err) {
      // Backend returns 409 if this package still has bookings (PROTECT).
      setError(err.response?.data?.detail || "Couldn't delete this package.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Packages</h1>
          <p>Manage tour packages</p>
        </div>
        <button className="btn btn-primary" onClick={showForm ? () => setShowForm(false) : startCreate}>
          {showForm ? "Cancel" : "+ Add Package"}
        </button>
      </div>

      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          {formError && <p className="form-error">{formError}</p>}

          <JsonImportPanel onImport={handleJsonImport} />
          <hr className="admin-form__divider" />

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input name="title" className="form-input" value={formData.title} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Destination</label>
              <select name="destination" className="form-select" value={formData.destination} onChange={handleChange} required>
                <option value="">Select destination</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Short Description</label>
            <input name="short_description" className="form-input" value={formData.short_description} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Full Description</label>
            <textarea name="description" rows="3" className="form-textarea" value={formData.description} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Duration (Days)</label>
              <input type="number" min="1" name="duration_days" className="form-input" value={formData.duration_days} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (Nights)</label>
              <input type="number" min="0" name="duration_nights" className="form-input" value={formData.duration_nights} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" name="start_date" className="form-input" value={formData.start_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" name="end_date" className="form-input" value={formData.end_date} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pickup Location</label>
            <input name="pickup_location" className="form-input" placeholder="e.g. Leh Airport" value={formData.pickup_location} onChange={handleChange} />
          </div>

          {formData.trip_type === "group_tour" && (
            <div className="form-group" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
              <label className="form-label">Pickup Points — Big cities (suggested via user location)</label>
              <p className="admin-form__note">Select one or more pickup hubs for this group tour. Admin manages pickup points via “Pickup Points” page. User at booking will see “Use my location” to suggest nearest.</p>
              {allPickupPoints.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "#64748b" }}>No pickup points yet. Create in Pickup Points page first.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8, maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#fff" }}>
                  {allPickupPoints.filter((p) => p.is_active).map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                      <input type="checkbox" checked={selectedPickupIds.includes(p.id)} onChange={(e) => {
                        if (e.target.checked) setSelectedPickupIds([...selectedPickupIds, p.id]);
                        else setSelectedPickupIds(selectedPickupIds.filter((x) => x !== p.id));
                      }} />
                      <span>{p.city} — {p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedPickupIds.length > 0 && <p style={{ fontSize: "0.78rem", color: "#0f7a6c", marginTop: 6 }}>{selectedPickupIds.length} pickup point(s) selected.</p>}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Price</label>
              <input type="number" min="0" step="0.01" name="price" className="form-input" value={formData.price} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Discount Price (optional)</label>
              <input type="number" min="0" step="0.01" name="discount_price" className="form-input" value={formData.discount_price} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Max Travelers</label>
              <input type="number" min="1" name="max_travelers" className="form-input" value={formData.max_travelers} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Available Slots</label>
              <input type="number" min="0" name="available_slots" className="form-input" value={formData.available_slots} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Trip Type *</label>
              <select name="trip_type" className="form-select" value={formData.trip_type} onChange={handleChange} style={{ borderColor: formData.trip_type === "independent_package" ? "#0f7a6c" : undefined, background: formData.trip_type === "independent_package" ? "#e6f5f2" : undefined }}>
                <option value="group_tour">Group Tour — Travel With Us</option>
                <option value="independent_package">Independent Package — We Arrange Your Trip</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category (Theme)</label>
              <select name="package_type" className="form-select" value={formData.package_type} onChange={handleChange}>
                {PACKAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select name="difficulty" className="form-select" value={formData.difficulty} onChange={handleChange}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Best Time to Visit</label>
              <input name="best_time_to_visit" className="form-input" placeholder="e.g. Oct-Mar" value={formData.best_time_to_visit} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Service Fee (for Independent)</label>
              <input type="number" min="0" step="0.01" name="service_fee" className="form-input" value={formData.service_fee} onChange={handleChange} />
            </div>
          </div>
          {formData.trip_type === "independent_package" && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#f8fafc", marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 12px", color: "#0f172a" }}>Independent Package — More Info</h4>
              <p className="admin-form__note" style={{ marginBottom: 12 }}>These fields appear only for independent packages (We Arrange Your Trip). They give travelers extra context on what we handle vs group tours where we bring them with us.</p>
              <div className="form-group">
                <label className="form-label">Package Category</label>
                <input name="category" className="form-input" placeholder="e.g. Kashmir Explorer" value={formData.category} onChange={handleChange} />
                <p className="admin-form__note">For independent packages, service breakdown will be used to compute final price (services + fee). Price field above is fallback.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Highlights (independent)</label>
                <textarea name="independent_highlights" rows="3" className="form-textarea" placeholder="e.g. Private vehicle throughout, flexible dates, handpicked hotels, 24/7 support" value={formData.independent_highlights} onChange={handleChange} />
                <p className="admin-form__note">Shown as bullet highlights on independent package detail page.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Flexibility Note</label>
                <input name="flexibility_note" className="form-input" placeholder="e.g. Choose your own travel dates & hotel tier" value={formData.flexibility_note} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Travel Requirements</label>
                <textarea name="travel_requirements" rows="3" className="form-textarea" placeholder="e.g. Passport required, visa assistance provided, health insurance recommended" value={formData.travel_requirements} onChange={handleChange} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              <input type="checkbox" name="is_featured" checked={formData.is_featured} onChange={handleChange} style={{ marginRight: 8 }} />
              Featured package
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Featured Image (hero on home &amp; package details)</label>
            {featuredPreview && !featuredFile && (
              <div style={{ marginBottom: 8 }}>
                <img src={featuredPreview} alt="Current featured" style={{ maxWidth: 240, maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <p className="admin-form__note" style={{ marginTop: 4 }}>Current image — choose a new file below to replace it.</p>
              </div>
            )}
            {featuredFile && (
              <div style={{ marginBottom: 8 }}>
                <p className="admin-form__note">New file selected: <strong>{featuredFile.name}</strong> — will upload on Save/Update.</p>
                <img src={URL.createObjectURL(featuredFile)} alt="New preview" style={{ maxWidth: 240, maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
              </div>
            )}
            {featuredUploadError && <p className="form-error">{featuredUploadError}</p>}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files[0] || null;
                setFeaturedFile(f);
                setFeaturedUploadError("");
              }}
            />
            <p className="admin-form__note">JPG/PNG/WebP recommended. Featured image is what users see on the home page and package hero.</p>
          </div>

          <hr className="admin-form__divider" />

          <SimpleListEditor label="Inclusions" items={inclusions} onChange={setInclusions} />
          <SimpleListEditor label="Exclusions" items={exclusions} onChange={setExclusions} />
          <ActivitiesEditor activities={activities} onChange={setActivities} />
          <FaqsEditor faqs={faqs} onChange={setFaqs} />

          {formData.trip_type === "independent_package" && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#f8fafc", marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 12px", color: "#0f172a" }}>Independent Package — Services Builder</h4>
              {!editingId ? (
                <p className="admin-form__note">Save the package first, then reopen to add services (Flight, Hotel, Transport etc) and travel dates. Services define the price breakdown.</p>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "end" }}>
                    <select className="form-select" style={{ flex: 1, minWidth: 160 }} value={newService.service} onChange={(e) => {
                      const sid = e.target.value;
                      const svc = allServices.find((s) => String(s.id) === sid);
                      if (svc) setNewService({ ...newService, service: sid, unit_price: svc.price });
                      else setNewService({ ...newService, service: sid });
                    }}>
                      <option value="">Select service</option>
                      {allServices.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {s.service_type} — {formatCurrency(s.price)}</option>
                      ))}
                    </select>
                    <input type="number" min="1" placeholder="Qty" className="form-input" style={{ width: 70 }} value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} />
                    <input type="number" step="0.01" placeholder="Unit price" className="form-input" style={{ width: 120 }} value={newService.unit_price} onChange={(e) => setNewService({ ...newService, unit_price: e.target.value })} />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}><input type="checkbox" checked={newService.is_included} onChange={(e) => setNewService({ ...newService, is_included: e.target.checked })} /> Incl.</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}><input type="checkbox" checked={newService.is_user_selectable} onChange={(e) => setNewService({ ...newService, is_user_selectable: e.target.checked })} /> User Choice</label>
                    <input placeholder="Group e.g. transport/hotel" className="form-input" style={{ width: 120 }} value={newService.option_group} onChange={(e) => setNewService({ ...newService, option_group: e.target.value })} disabled={!newService.is_user_selectable} />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}><input type="checkbox" checked={newService.is_default_selected} onChange={(e) => setNewService({ ...newService, is_default_selected: e.target.checked })} disabled={!newService.is_user_selectable} /> Default</label>
                    <button type="button" className="btn btn-primary" onClick={async () => {
                      if (!newService.service) return;
                      try {
                        const payload = { service: Number(newService.service), quantity: Number(newService.quantity) || 1, unit_price: newService.unit_price || undefined, is_included: newService.is_included, is_user_selectable: newService.is_user_selectable, option_group: newService.option_group || "", is_default_selected: newService.is_default_selected };
                        const created = await packageApi.packageServices(editingId, payload);
                        setPkgServices([...pkgServices, created]);
                        setNewService({ service: "", quantity: 1, unit_price: "", is_included: true, is_user_selectable: false, option_group: "", is_default_selected: false });
                      } catch (err) {
                        setFormError(err.response?.data?.detail || JSON.stringify(err.response?.data) || "Couldn't add service");
                      }
                    }}>Add Service</button>
                  </div>
                  {pkgServices.length > 0 ? (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                      {pkgServices.map((ps) => (
                        <div key={ps.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", background: "#fff", fontSize: "0.88rem" }}>
                          <div>
                            <strong>{ps.service?.name}</strong> <small style={{ color: "#64748b" }}>×{ps.quantity} · {formatCurrency(ps.unit_price)} = {formatCurrency(ps.total_price)}</small>
                            <span style={{ marginLeft: 8, fontSize: "0.7rem", padding: "2px 6px", borderRadius: 999, background: ps.is_included ? "#e6f5f2" : "#fef2f2", color: ps.is_included ? "#0f7a6c" : "#dc2626" }}>{ps.is_included ? "Included" : "Excluded"}</span>
                            {ps.is_user_selectable && <span style={{ marginLeft: 6, fontSize: "0.7rem", padding: "2px 6px", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>Choice: {ps.option_group || "group"} {ps.is_default_selected ? "★" : ""}</span>}
                          </div>
                          <button type="button" className="admin-list-row__remove" onClick={async () => {
                            try { await packageApi.removePackageService(ps.id); setPkgServices(pkgServices.filter((x) => x.id !== ps.id)); } catch {}
                          }}>✕</button>
                        </div>
                      ))}
                      <div style={{ padding: "8px 12px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>Service Cost + Fee ({formatCurrency(formData.service_fee)})</span>
                        <span>{formatCurrency(pkgServices.filter((p) => p.is_included).reduce((a, b) => a + Number(b.total_price), 0) + Number(formData.service_fee || 0))} (default selection for choice groups)</span>
                      </div>
                    </div>
                  ) : <p className="admin-form__note">No services yet. Add Flight, Hotel, Transport, Guide, Activities etc. Mark as “User Choice” to let traveler pick (e.g., group transport = Flight vs Train vs Van; group hotel = Budget vs Luxury). Set one as Default.</p>}

                  <h5 style={{ margin: "12px 0 8px", color: "#0f172a" }}>Travel Dates</h5>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <input type="date" className="form-input" style={{ flex: 1 }} value={newTravelDate.travel_date} onChange={(e) => setNewTravelDate({ ...newTravelDate, travel_date: e.target.value })} />
                    <select className="form-select" value={newTravelDate.status} onChange={(e) => setNewTravelDate({ ...newTravelDate, status: e.target.value })}>
                      <option value="available">Available</option>
                      <option value="limited">Limited</option>
                      <option value="not_available">Not Available</option>
                    </select>
                    <input type="number" placeholder="Slots (optional)" className="form-input" style={{ width: 130 }} value={newTravelDate.available_slots} onChange={(e) => setNewTravelDate({ ...newTravelDate, available_slots: e.target.value })} />
                    <button type="button" className="btn btn-outline" onClick={async () => {
                      if (!newTravelDate.travel_date) return;
                      try {
                        const created = await packageApi.addTravelDate(editingId, { travel_date: newTravelDate.travel_date, status: newTravelDate.status, available_slots: newTravelDate.available_slots || null });
                        setTravelDates([...travelDates, created]);
                        setNewTravelDate({ travel_date: "", status: "available", available_slots: "" });
                      } catch (err) {
                        setFormError(err.response?.data?.travel_date || JSON.stringify(err.response?.data) || "Couldn't add date");
                      }
                    }}>Add Date</button>
                  </div>
                  {travelDates.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {travelDates.map((td) => (
                        <span key={td.id} style={{ border: "1px solid #e2e8f0", borderRadius: 999, padding: "4px 10px", background: td.status === "available" ? "#e6f5f2" : td.status === "limited" ? "#fef3c7" : "#fef2f2", fontSize: "0.82rem" }}>
                          {td.travel_date} · {td.status}
                          <button type="button" onClick={async () => { try { await packageApi.removeTravelDate(td.id); setTravelDates(travelDates.filter((x) => x.id !== td.id)); } catch {} }} style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {editingId ? (
            <ImagesManager pkgId={editingId} images={images} onChange={setImages} />
          ) : (
            <p className="admin-form__note">
              Save the package first, then reopen it for editing to add place photos.
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Package" : "Save Package"}
          </button>
        </form>
      )}

      <div className="admin-toolbar">
        <input className="form-input" placeholder="Search packages..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <Loader label="Loading packages..." />
      ) : error && packages.length === 0 ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : (
        <>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Destination</th>
                  <th>Trip Type</th>
                  <th>Price</th>
                  <th>Slots</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.id}</td>
                    <td>{pkg.title}</td>
                    <td>{pkg.destination_name}</td>
                    <td><span className="badge" style={{ background: pkg.trip_type === "independent_package" ? "#e6f5f2" : "#f1f5f9", color: pkg.trip_type === "independent_package" ? "#0f7a6c" : "#475569" }}>{pkg.trip_type === "independent_package" ? "Independent" : "Group"}</span></td>
                    <td>{formatCurrency(pkg.trip_type === "independent_package" && pkg.computed_price ? pkg.computed_price : pkg.price)}</td>
                    <td>{pkg.available_slots}</td>
                    <td>
                      <span className={`badge ${pkg.status === "published" ? "badge-success" : "badge-warning"}`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td>{pkg.is_featured ? "★" : "—"}</td>
                    <td className="admin-table__actions">
                      <button onClick={() => startEdit(pkg)}>Edit</button>
                      <button className="danger" onClick={() => handleDelete(pkg)}>Delete</button>
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
