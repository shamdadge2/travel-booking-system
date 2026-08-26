import api from "./axios";

const authApi = {
  register: (payload) => api.post("/auth/register/", payload).then((res) => res.data),
  login: (payload) => api.post("/auth/login/", payload).then((res) => res.data),
  googleLogin: (idToken) => api.post("/auth/google/", { id_token: idToken }).then((res) => res.data),
  logout: (refresh) => api.post("/auth/logout/", { refresh }).then((res) => res.data),
  getProfile: () => api.get("/auth/profile/").then((res) => res.data),
  updateProfile: (payload) => api.patch("/auth/profile/", payload).then((res) => res.data),
  changePassword: (payload) =>
    api.post("/auth/change-password/", payload).then((res) => res.data),

  // Admin user management
  listUsers: (params) => api.get("/auth/users/", { params }).then((res) => res.data),
  getUser: (id) => api.get(`/auth/users/${id}/`).then((res) => res.data),
  updateUser: (id, payload) => api.patch(`/auth/users/${id}/`, payload).then((res) => res.data),
  deleteUser: (id) => api.delete(`/auth/users/${id}/`).then((res) => res.data),
};

export default authApi;
