import api from "./axios";

const destinationApi = {
  list: (params, config) => api.get("/destinations/", { params, ...config }).then((res) => res.data),
  get: (id) => api.get(`/destinations/${id}/`).then((res) => res.data),
  create: (payload) => api.post("/destinations/create/", payload).then((res) => res.data),
  update: (id, payload) =>
    api.patch(`/destinations/${id}/update/`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/destinations/${id}/delete/`).then((res) => res.data),
};

export default destinationApi;
