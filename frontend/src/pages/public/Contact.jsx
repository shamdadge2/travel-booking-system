import { useState } from "react";
import contactApi from "../../api/contactApi";
import "./Contact.css";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await contactApi.send(formData);
      setSubmitted(true);
    } catch (err) {
      const data = err.response?.data;
      const message = data && typeof data === "object" ? Object.values(data)[0] : null;
      setError((Array.isArray(message) ? message[0] : message) || "Couldn't send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container contact-page">
      <div className="page-header">
        <h1>Contact Us</h1>
        <p>Questions about a booking or a package? We're happy to help.</p>
      </div>

      <div className="contact-page__grid">
        <div className="card contact-page__info">
          <h3>Get in Touch</h3>
          <p><strong>Email:</strong> <a href="mailto:shamdadge058@gmail.com">shamdadge058@gmail.com</a></p>
          <p><strong>Phone:</strong> <a href="tel:+919529232912">+91 9529232912</a></p>
          <p><strong>Hours:</strong> Mon–Sat, 9am–7pm IST</p>
          <p className="contact-page__note">
            Messages sent through this form go straight to our admin team's dashboard —
            we'll respond by email as soon as we can.
          </p>
        </div>

        <div className="card contact-page__form-wrap">
          {submitted ? (
            <p className="badge badge-success">
              Thanks! Your message has been received — we'll get back to you shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <p className="form-error">{error}</p>}
              <div className="form-group">
                <label className="form-label" htmlFor="name">Name</label>
                <input id="name" name="name" type="text" className="form-input" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" className="form-input" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="message">Message</label>
                <textarea id="message" name="message" rows="5" className="form-textarea" value={formData.message} onChange={handleChange} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
