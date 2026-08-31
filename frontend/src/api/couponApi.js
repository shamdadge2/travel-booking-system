import api from "./axios";

const couponApi = {
  list: (params) => api.get("/packages/coupons/", { params }).then((res) => res.data),
  get: (id) => api.get(`/packages/coupons/${id}/`).then((res) => res.data),
  create: (payload) => api.post("/packages/coupons/", payload).then((res) => res.data),
  update: (id, payload) => api.patch(`/packages/coupons/${id}/`, payload).then((res) => res.data),
  remove: (id) => api.delete(`/packages/coupons/${id}/`).then((res) => res.data),
  validate: (payload) => api.post("/packages/coupons/validate/", payload).then((res) => res.data),
};

export default couponApi;
