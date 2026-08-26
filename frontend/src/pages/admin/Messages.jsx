import { useEffect, useState } from "react";
import { formatDate } from "../../utils/formatters";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import contactApi from "../../api/contactApi";
import "./AdminTable.css";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setIsLoading(true);
    contactApi
      .listMessages({ page_size: 100 })
      .then((data) => setMessages(data.results))
      .catch(() => setError("Couldn't load messages."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const toggleRead = async (message) => {
    try {
      const updated = await contactApi.updateMessage(message.id, { is_read: !message.is_read });
      setMessages(messages.map((m) => (m.id === message.id ? updated : m)));
    } catch {
      setError("Couldn't update this message.");
    }
  };

  const handleDelete = async (message) => {
    try {
      await contactApi.removeMessage(message.id);
      setMessages(messages.filter((m) => m.id !== message.id));
    } catch {
      setError("Couldn't delete this message.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Messages</h1>
          <p>Contact form submissions from the website</p>
        </div>
      </div>

      {isLoading ? (
        <Loader label="Loading messages..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : messages.length === 0 ? (
        <EmptyState title="No messages yet" message="Contact form submissions will show up here." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Email</th>
                <th>Message</th>
                <th>Received</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td>{message.name}</td>
                  <td><a href={`mailto:${message.email}`}>{message.email}</a></td>
                  <td style={{ whiteSpace: "normal", maxWidth: 360 }}>{message.message}</td>
                  <td>{formatDate(message.created_at)}</td>
                  <td>
                    <span className={`badge ${message.is_read ? "badge-success" : "badge-warning"}`}>
                      {message.is_read ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <button onClick={() => toggleRead(message)}>
                      Mark {message.is_read ? "Unread" : "Read"}
                    </button>
                    <button className="danger" onClick={() => handleDelete(message)}>Delete</button>
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
