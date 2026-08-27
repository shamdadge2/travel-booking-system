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
    <div className="contact-page">
      {/* Hero - NO image, solid dark gradient matching homepage palette */}
      <section className="contact-hero">
        <div className="contact-hero__inner container">
          <div className="contact-hero__content">
            <span className="contact-hero__eyebrow">GET IN TOUCH</span>
            <h1 className="contact-hero__title">Contact Us</h1>
            <p className="contact-hero__desc">
              Questions about a booking or a package? We&apos;re happy to help — reach out and we&apos;ll respond as soon as we can.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="contact-content">
        <div className="container">
          <div className="contact-page__grid">
            <div className="contact-card contact-card--info">
              <div className="contact-card__icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h16v16H4z" /><path d="M4 7l8 7 8-7" /></svg>
              </div>
              <h3>Get in Touch</h3>
              <div className="contact-card__rows">
                <p>
                  <span className="contact-card__label">Email</span>
                  <a href="mailto:shamdadge058@gmail.com">shamdadge058@gmail.com</a>
                </p>
                <p>
                  <span className="contact-card__label">Phone</span>
                  <a href="tel:+919529232912">+91 9529232912</a>
                </p>
                <p>
                  <span className="contact-card__label">Hours</span>
                  <span>Mon–Sat, 9am–7pm IST</span>
                </p>
              </div>
              <p className="contact-card__note">
                Messages sent through this form go straight to our admin dashboard — we&apos;ll reply by email.
              </p>
            </div>

            <div className="contact-card contact-card--form">
              {submitted ? (
                <div className="contact-success">
                  <div className="contact-success__icon">✓</div>
                  <h3>Message sent!</h3>
                  <p>Thanks! Your message has been received — we&apos;ll get back to you shortly.</p>
                  <button className="btn btn-outline" onClick={() => setSubmitted(false)}>Send another message</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <h3 className="contact-form__title">Send a Message</h3>
                  <p className="contact-form__sub">Fill the form and we&apos;ll get back within 24 hours.</p>
                  {error && <p className="form-error contact-form__error">{error}</p>}
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">Name</label>
                    <input id="name" name="name" type="text" className="form-input contact-input" placeholder="Your name" value={formData.name} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" className="form-input contact-input" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="message">Message</label>
                    <textarea id="message" name="message" rows="5" className="form-textarea contact-input" placeholder="How can we help you?" value={formData.message} onChange={handleChange} required />
                  </div>
                  <button type="submit" className="btn btn-primary contact-submit" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                    {!submitting && <span aria-hidden="true"> →</span>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
