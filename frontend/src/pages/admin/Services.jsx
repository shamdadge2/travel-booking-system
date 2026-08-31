import { useEffect, useState } from "react";
import { formatCurrency } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import serviceApi from "../../api/serviceApi";
import "./AdminTable.css";
import "./AdminForm.css";

const SERVICE_TYPES = ["transportation","accommodation","guide","activity","sightseeing","meals","other"];
const SERVICE_CATEGORIES = ["flight","train","bus","private_vehicle","airport_transfer","hotel","guide_service","activity_service","attraction","meal_service","other"];

const EMPTY_FORM = { service_type: "transportation", service_category: "other", name: "", description: "", location: "", price: "", unit: "per_person", is_active: true, max_capacity: "" };

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => {
    setIsLoading(true);
    const params = { page_size: 100 };
    if (search) params.search = search;
    serviceApi.list(params).then((data) => setServices(data.results || data)).catch(() => setError("Couldn't load services")).finally(() => setIsLoading(false));
  };
  useEffect(() => { const t=setTimeout(load,300); return()=>clearTimeout(t); }, [search]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type==="checkbox"?checked:value });
  };
  const startCreate = () => { setEditingId(null); setFormData(EMPTY_FORM); setShowForm(true); };
  const startEdit = (s) => {
    setEditingId(s.id);
    setFormData({ service_type: s.service_type, service_category: s.service_category, name: s.name, description: s.description || "", location: s.location || "", price: s.price, unit: s.unit || "per_person", is_active: s.is_active, max_capacity: s.max_capacity || "" });
    setShowForm(true);
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...formData, price: String(formData.price), max_capacity: formData.max_capacity || null };
      if (editingId) await serviceApi.update(editingId, payload);
      else await serviceApi.create(payload);
      setShowForm(false); load();
    } catch (err) {
      const d=err.response?.data; setError(d?JSON.stringify(d):"Couldn't save");
    } finally { setSaving(false); }
  };
  const handleDelete = async (s) => {
    try { await serviceApi.remove(s.id); setServices(services.filter((x)=>x.id!==s.id)); } catch (err) { setError(err.response?.data?.detail || "Couldn't delete"); }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div><h1>Travel Services</h1><p>Manage individual services: Flight, Hotel, Guide, Activities, etc. Used in Independent Packages.</p></div>
        <button className="btn btn-primary" onClick={showForm ? ()=>setShowForm(false) : startCreate}>{showForm ? "Cancel" : "+ Add Service"}</button>
      </div>
      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Service Type</label><select name="service_type" className="form-select" value={formData.service_type} onChange={handleChange}>{SERVICE_TYPES.map((t)=><option key={t} value={t}>{t}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Category</label><select name="service_category" className="form-select" value={formData.service_category} onChange={handleChange}>{SERVICE_CATEGORIES.map((c)=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Unit</label><select name="unit" className="form-select" value={formData.unit} onChange={handleChange}><option value="per_person">Per Person</option><option value="per_night">Per Night</option><option value="per_trip">Per Trip</option></select></div>
          </div>
          <div className="form-group"><label className="form-label">Name</label><input name="name" className="form-input" value={formData.name} onChange={handleChange} required placeholder="e.g. Flight Delhi-Srinagar" /></div>
          <div className="form-group"><label className="form-label">Description</label><textarea name="description" className="form-textarea" rows="2" value={formData.description} onChange={handleChange} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Location</label><input name="location" className="form-input" value={formData.location} onChange={handleChange} placeholder="e.g. Srinagar" /></div>
            <div className="form-group"><label className="form-label">Price</label><input type="number" step="0.01" name="price" className="form-input" value={formData.price} onChange={handleChange} required /></div>
            <div className="form-group"><label className="form-label">Capacity (optional)</label><input type="number" name="max_capacity" className="form-input" value={formData.max_capacity} onChange={handleChange} /></div>
          </div>
          <div className="form-group"><label className="form-label"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} style={{ marginRight: 8 }} />Active (available for booking)</label></div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Update Service" : "Create Service"}</button>
        </form>
      )}
      <div className="admin-toolbar"><input className="form-input" placeholder="Search services..." value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
      {isLoading ? <Loader label="Loading services..." /> : (
        <>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Category</th><th>Price</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {services.map((s)=>(
                  <tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td><span className="badge" style={{ textTransform: "capitalize" }}>{s.service_type}</span></td><td>{s.service_category}</td><td>{formatCurrency(s.price)}</td><td>{s.is_active ? "✅" : "❌"}</td>
                  <td className="admin-table__actions"><button onClick={()=>startEdit(s)}>Edit</button><button className="danger" onClick={()=>handleDelete(s)}>Delete</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {services.length===0 && <EmptyState title="No services" message="Create your first service to use in independent packages." />}
        </>
      )}
    </div>
  );
}
