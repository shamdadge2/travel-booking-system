import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import authApi from "../../api/authApi";
import "./Profile.css";

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await authApi.updateProfile(formData);
      await refreshProfile();
      setEditing(false);
      setSaved(true);
    } catch (err) {
      const errors = err.response?.data;
      const firstError = errors && typeof errors === "object" ? Object.values(errors)[0] : null;
      setError((Array.isArray(firstError) ? firstError[0] : firstError) || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    new_password2: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const handlePasswordChange = (event) => {
    setPasswordData({ ...passwordData, [event.target.name]: event.target.value });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordSaving(true);
    try {
      await authApi.changePassword(passwordData);
      setPasswordMessage({ type: "success", text: "Password changed successfully." });
      setPasswordData({ old_password: "", new_password: "", new_password2: "" });
    } catch (err) {
      const errors = err.response?.data;
      const firstError = errors && typeof errors === "object" ? Object.values(errors)[0] : null;
      setPasswordMessage({
        type: "error",
        text: (Array.isArray(firstError) ? firstError[0] : firstError) || "Couldn't change password.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="container profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your personal information.</p>
      </div>

      {saved && <p className="badge badge-success profile-page__saved">Profile updated.</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="card profile-page__card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={user?.username || ""} disabled />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="first_name">First Name</label>
              <input id="first_name" name="first_name" className="form-input" value={formData.first_name} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input id="last_name" name="last_name" className="form-input" value={formData.last_name} onChange={handleChange} disabled={!editing} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input" value={formData.email} onChange={handleChange} disabled={!editing} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" className="form-input" value={formData.phone} onChange={handleChange} disabled={!editing} />
          </div>

          {editing ? (
            <div className="profile-page__actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit Profile</button>
          )}
        </form>
      </div>

      <div className="card profile-page__card profile-page__password">
        <h3>Change Password</h3>
        {passwordMessage && (
          <p className={passwordMessage.type === "success" ? "badge badge-success" : "form-error"}>
            {passwordMessage.text}
          </p>
        )}
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              name="old_password"
              className="form-input"
              value={passwordData.old_password}
              onChange={handlePasswordChange}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                name="new_password"
                className="form-input"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                name="new_password2"
                className="form-input"
                value={passwordData.new_password2}
                onChange={handlePasswordChange}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-outline" disabled={passwordSaving}>
            {passwordSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
