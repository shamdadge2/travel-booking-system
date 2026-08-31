import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import couponApi from "../../api/couponApi";
import "./AdminTable.css";
import "./AdminForm.css";

const EMPTY_FORM = { code: "", discount_type: "fixed", discount_value: "", min_booking_amount: "0", max_discount: "", valid_from: "", valid_until: "", usage_limit: "", is_active: true, applicable_trip_type: "" };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    couponApi.list().then((data) => setCoupons(data.results || data)).catch(()=>setError("Couldn't load coupons")).finally(()=>setIsLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type==="checkbox"?checked:value });
  };
  const startCreate = () => { setEditingId(null); setFormData(EMPTY_FORM); setShowForm(true); };
  const startEdit = (c) => {
    setEditingId(c.id);
    setFormData({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_booking_amount: c.min_booking_amount,
      max_discount: c.max_discount || "",
      valid_from: c.valid_from ? c.valid_from.slice(0,16) : "",
      valid_until: c.valid_until ? c.valid_until.slice(0,16) : "",
      usage_limit: c.usage_limit || "",
      is_active: c.is_active,
      applicable_trip_type: c.applicable_trip_type || "",
    });
    setShowForm(true);
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        min_booking_amount: formData.min_booking_amount || "0",
        max_discount: formData.max_discount || null,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        usage_limit: formData.usage_limit ? Number(formData.usage_limit) : null,
        is_active: formData.is_active,
        applicable_trip_type: formData.applicable_trip_type || null,
      };
      if (editingId) await couponApi.update(editingId, payload);
      else await couponApi.create(payload);
      setShowForm(false); load();
    } catch (err) {
      const d=err.response?.data; setError(d?JSON.stringify(d):"Couldn't save");
    } finally { setSaving(false); }
  };
  const handleDelete = async (c) => {
    try { await couponApi.remove(c.id); setCoupons(coupons.filter((x)=>x.id!==c.id)); } catch (err) { setError(err.response?.data?.detail || "Couldn't delete"); }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div><h1>Coupons</h1><p>Manage discount codes for bookings (percentage or fixed).</p></div>
        <button className="btn btn-primary" onClick={showForm ? ()=>setShowForm(false) : startCreate}>{showForm ? "Cancel" : "+ Add Coupon"}</button>
      </div>
      {showForm && (
        <form className="card admin-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Code</label><input name="code" className="form-input" value={formData.code} onChange={handleChange} required placeholder="SAVE2000" style={{ textTransform: "uppercase" }} /></div>
            <div className="form-group"><label className="form-label">Discount Type</label><select name="discount_type" className="form-select" value={formData.discount_type} onChange={handleChange}><option value="fixed">Fixed</option><option value="percent">Percent</option></select></div>
            <div className="form-group"><label className="form-label">Value</label><input type="number" step="0.01" name="discount_value" className="form-input" value={formData.discount_value} onChange={handleChange} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Min Booking Amount</label><input type="number" step="0.01" name="min_booking_amount" className="form-input" value={formData.min_booking_amount} onChange={handleChange} /></div>
            <div className="form-group"><label className="form-label">Max Discount (for %)</label><input type="number" step="0.01" name="max_discount" className="form-input" value={formData.max_discount} onChange={handleChange} placeholder="Optional cap" /></div>
            <div className="form-group"><label className="form-label">Usage Limit</label><input type="number" name="usage_limit" className="form-input" value={formData.usage_limit} onChange={handleChange} placeholder="Null = unlimited" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Valid From</label><input type="datetime-local" name="valid_from" className="form-input" value={formData.valid_from} onChange={handleChange} /></div>
            <div className="form-group"><label className="form-label">Valid Until</label><input type="datetime-local" name="valid_until" className="form-input" value={formData.valid_until} onChange={handleChange} /></div>
            <div className="form-group"><label className="form-label">Applicable Trip Type</label><select name="applicable_trip_type" className="form-select" value={formData.applicable_trip_type} onChange={handleChange}><option value="">All</option><option value="group_tour">Group Tour</option><option value="independent_package">Independent</option></select></div>
          </div>
          <div className="form-group"><label className="form-label"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} style={{ marginRight: 8 }} />Active</label></div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}</button>
        </form>
      )}
      {isLoading ? <Loader label="Loading coupons..." /> : (
        <>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Amount</th><th>Used</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {coupons.map((c)=>(
                  <tr key={c.id}><td><strong>{c.code}</strong></td><td>{c.discount_type}</td><td>{c.discount_type==="percent"? `${c.discount_value}%` : formatCurrency(c.discount_value)}</td><td>{formatCurrency(c.min_booking_amount)}</td><td>{c.used_count}{c.usage_limit?`/${c.usage_limit}`:""}</td><td>{c.is_active ? "✅" : "❌"}</td>
                  <td className="admin-table__actions"><button onClick={()=>startEdit(c)}>Edit</button><button className="danger" onClick={()=>handleDelete(c)}>Delete</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {coupons.length===0 && <EmptyState title="No coupons" message="Create a coupon to offer discounts." />}
        </>
      )}
    </div>
  );
}
