import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import GoogleLoginButton from "../../components/GoogleLoginButton";
import "./Auth.css";

export default function Login() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (localStorage.getItem("session_expired") === "1") {
        setError("Your session expired — you were logged in from another device. Please log in again.");
        localStorage.removeItem("session_expired");
      }
    } catch {}
  }, []);

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.username || !formData.password) {
      setError("Please enter both username/email and password.");
      return;
    }

    const result = await login(formData);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Welcome Back</h1>
        <p className="auth-card__subtitle">Log in to manage your bookings</p>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username or Email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="auth-card__divider"><span>or</span></div>

        <div className="auth-card__google">
          <GoogleLoginButton onSuccess={() => navigate("/")} onError={setError} />
        </div>

        <p className="auth-card__footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
