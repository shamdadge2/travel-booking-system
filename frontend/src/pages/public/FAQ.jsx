import { useState } from "react";
import "./FAQ.css";

const FAQS = [
  {
    question: "How do I book a package?",
    answer:
      "Browse packages, open the one you like, and click \"Book This Package.\" You'll fill in traveler details and confirm — your booking reference and total cost are generated automatically.",
  },
  {
    question: "Can I cancel a booking?",
    answer:
      "Yes, as long as your booking is still pending or confirmed and the travel date hasn't passed. Go to My Bookings and use the Cancel button on the booking.",
  },
  {
    question: "How is the total price calculated?",
    answer:
      "Total price is always the package's per-person price (or discounted price, if one applies) multiplied by the number of travelers — calculated on our server, not in your browser.",
  },
  {
    question: "What payment methods are supported?",
    answer: "Card, UPI, and net banking are supported through our secure payment flow.",
  },
  {
    question: "Can I leave a review?",
    answer: "Yes — once you've completed a booking, you can leave a rating and review for that package.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="container faq-page">
      <div className="page-header">
        <h1>Frequently Asked Questions</h1>
        <p>Everything you need to know about booking with us.</p>
      </div>

      <div className="accordion">
        {FAQS.map((faq, index) => (
          <div key={faq.question} className="accordion__item card">
            <button className="accordion__question" onClick={() => toggle(index)}>
              {faq.question}
              <span>{openIndex === index ? "−" : "+"}</span>
            </button>
            {openIndex === index && <p className="accordion__answer">{faq.answer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
