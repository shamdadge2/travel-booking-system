import api from "./axios";

const pickupPointApi = {
  list: (params) => api.get("/packages/pickup-points/", { params }).then((res) => res.data),
  create: (payload) => api.post("/packages/pickup-points/", payload).then((res) => res.data),
  get: (id, params) => api.get(`/packages/pickup-points/${id}/`, { params }).then((res) => res.data),
  update: (id, payload) => api.patch(`/packages/pickup-points/${id}/`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/packages/pickup-points/${id}/`).then((res) => res.data),
  nearest: (params) => api.get("/packages/pickup-points/nearest/", { params }).then((res) => res.data),
};

export default pickupPointApi;
