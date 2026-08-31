import api from "./axios";

const packageApi = {
  list: (params, config) => api.get("/packages/", { params, ...config }).then((res) => res.data),
  search: (params, config) =>
    api.get("/packages/search/", { params, ...config }).then((res) => res.data),
  featured: (params) => api.get("/packages/featured/", { params }).then((res) => res.data),
  get: (id) => api.get(`/packages/${id}/`).then((res) => res.data),
  availability: (id, travelers, date) => {
    const params = {};
    if (travelers) params.travelers = travelers;
    if (date) params.date = date;
    return api.get(`/packages/${id}/availability/`, { params }).then((res) => res.data);
  },
  services: (id) => api.get(`/packages/${id}/services/`).then((res) => res.data),
  priceCalculate: (id, payload) => api.post(`/packages/${id}/price/calculate/`, payload).then((res) => res.data),
  priceCalculateGet: (id, params) => api.get(`/packages/${id}/price/calculate/`, { params }).then((res) => res.data),
  travelDates: (id) => api.get(`/packages/${id}/travel-dates/`).then((res) => res.data),
  addTravelDate: (id, payload) => api.post(`/packages/${id}/travel-dates/`, payload).then((res) => res.data),
  updateTravelDate: (dateId, payload) => api.patch(`/packages/travel-dates/${dateId}/`, payload).then((res) => res.data),
  removeTravelDate: (dateId) => api.delete(`/packages/travel-dates/${dateId}/`).then((res) => res.data),
  packageServices: (id, payload) => api.post(`/packages/${id}/services/add/`, payload).then((res) => res.data),
  updatePackageService: (psId, payload) => api.patch(`/packages/package-services/${psId}/`, payload).then((res) => res.data),
  removePackageService: (psId) => api.delete(`/packages/package-services/${psId}/`).then((res) => res.data),
  reorderServices: (id, order) => api.post(`/packages/${id}/services/reorder/`, { order }).then((res) => res.data),
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
