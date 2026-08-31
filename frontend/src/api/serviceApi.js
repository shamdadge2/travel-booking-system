import api from "./axios";

const serviceApi = {
  list: (params) => api.get("/packages/services/", { params }).then((res) => res.data),
  get: (id) => api.get(`/packages/services/${id}/`).then((res) => res.data),
  create: (payload) => api.post("/packages/services/", payload).then((res) => res.data),
  update: (id, payload) => api.patch(`/packages/services/${id}/`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/packages/services/${id}/`).then((res) => res.data),
};

export default serviceApi;
