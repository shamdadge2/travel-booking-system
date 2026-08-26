import api from "./axios";

const reviewApi = {
  listForPackage: (packageId) =>
    api.get(`/packages/${packageId}/reviews/`).then((res) => res.data),
  createForPackage: (packageId, payload) =>
    api.post(`/packages/${packageId}/reviews/`, payload).then((res) => res.data),
  update: (reviewId, payload) => api.put(`/reviews/${reviewId}/`, payload).then((res) => res.data),
  remove: (reviewId) => api.delete(`/reviews/${reviewId}/`).then((res) => res.data),
};

export default reviewApi;
