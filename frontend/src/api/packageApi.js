import api from "./axios";

const packageApi = {
  list: (params, config) => api.get("/packages/", { params, ...config }).then((res) => res.data),
  search: (params, config) =>
    api.get("/packages/search/", { params, ...config }).then((res) => res.data),
  featured: (params) => api.get("/packages/featured/", { params }).then((res) => res.data),
  get: (id) => api.get(`/packages/${id}/`).then((res) => res.data),
  availability: (id, travelers) =>
    api
      .get(`/packages/${id}/availability/`, { params: travelers ? { travelers } : {} })
      .then((res) => res.data),
  create: (payload) => api.post("/packages/create/", payload).then((res) => res.data),
  update: (id, payload) => api.patch(`/packages/${id}/update/`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/packages/${id}/delete/`).then((res) => res.data),

  addImage: (id, formData) =>
    // Do NOT set Content-Type manually here — the browser needs to
    // generate it itself (including the multipart boundary) based on
    // the FormData contents. Setting it to a bare "multipart/form-data"
    // string without a boundary produces a request Django's
    // MultiPartParser can't parse, so the upload silently fails.
    api.post(`/packages/${id}/images/add/`, formData).then((res) => res.data),
  removeImage: (imageId) =>
    api.delete(`/packages/images/${imageId}/delete/`).then((res) => res.data),
};

export default packageApi;
