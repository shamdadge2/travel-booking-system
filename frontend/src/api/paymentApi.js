import api from "./axios";

const paymentApi = {
  create: (payload) => api.post("/payments/", payload).then((res) => res.data),
  list: (params) => api.get("/payments/", { params }).then((res) => res.data),
  get: (id) => api.get(`/payments/${id}/`).then((res) => res.data),
  process: (id, payload) => api.post(`/payments/${id}/process/`, payload).then((res) => res.data),
  submitReference: (id, payload) => api.post(`/payments/${id}/reference/`, payload).then((res) => res.data),
  getSettings: () => api.get("/payments/settings/").then((res) => res.data),
  updateSettings: (payload) => api.put("/payments/settings/", payload).then((res) => res.data),
};

export default paymentApi;
