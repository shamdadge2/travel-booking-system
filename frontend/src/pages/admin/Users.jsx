import { useEffect, useState } from "react";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import authApi from "../../api/authApi";
import useAuth from "../../hooks/useAuth";
import "./AdminTable.css";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const loadUsers = () => {
    setIsLoading(true);
    const params = search ? { search } : undefined;
    authApi
      .listUsers(params)
      .then((data) => setUsers(data))
      .catch(() => setError("Couldn't load users."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(loadUsers, 300); // debounce search typing
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleActive = async (targetUser) => {
    setActionError("");
    try {
      const updated = await authApi.updateUser(targetUser.id, { is_active: !targetUser.is_active });
      setUsers(users.map((u) => (u.id === targetUser.id ? updated : u)));
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't update this user.");
    }
  };

  return (
    <div>
      <div className="admin-page__header">
        <div>
          <h1>Users</h1>
          <p>Manage customer, staff and admin accounts</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          className="form-input"
          placeholder="Search users..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {actionError && <p className="form-error">{actionError}</p>}

      {isLoading ? (
        <Loader label="Loading users..." />
      ) : error ? (
        <EmptyState tone="error" title="Something went wrong" message={error} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td style={{ textTransform: "capitalize" }}>{user.role}</td>
                  <td>
                    <span className={`badge ${user.is_active ? "badge-success" : "badge-danger"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={user.id === currentUser?.id}
                      title={user.id === currentUser?.id ? "You can't deactivate your own account" : ""}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </button>
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
