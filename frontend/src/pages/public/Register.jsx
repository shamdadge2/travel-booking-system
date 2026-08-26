import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import GoogleLoginButton from "../../components/GoogleLoginButton";
import "./Auth.css";

const INITIAL_FORM = {
  username: "",
  email: "",
  password: "",
  password2: "",
  first_name: "",
  last_name: "",
  phone: "",
};

export default function Register() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.password2) {
      setError("Passwords do not match.");
      return;
    }

    const result = await register(formData);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Create Your Account</h1>
        <p className="auth-card__subtitle">Sign up to start booking trips</p>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="first_name">First Name</label>
              <input id="first_name" name="first_name" type="text" className="form-input" value={formData.first_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input id="last_name" name="last_name" type="text" className="form-input" value={formData.last_name} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" name="username" type="text" className="form-input" value={formData.username} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input" value={formData.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="text" className="form-input" value={formData.phone} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="form-input" value={formData.password} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password2">Confirm Password</label>
              <input id="password2" name="password2" type="password" className="form-input" value={formData.password2} onChange={handleChange} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="auth-card__divider"><span>or</span></div>

        <div className="auth-card__google">
          <GoogleLoginButton onSuccess={() => navigate("/")} onError={setError} />
        </div>

        <p className="auth-card__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
