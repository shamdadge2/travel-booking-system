import api from "./axios";

const bookingApi = {
  list: (params) => api.get("/bookings/", { params }).then((res) => res.data),
  get: (id) => api.get(`/bookings/${id}/`).then((res) => res.data),
  create: (payload) => api.post("/bookings/", payload).then((res) => res.data),
  update: (id, payload) => api.patch(`/bookings/${id}/`, payload).then((res) => res.data),
  cancel: (id) => api.post(`/bookings/${id}/cancel/`).then((res) => res.data),
  invoice: (id) => api.get(`/bookings/${id}/invoice/`).then((res) => res.data),
  stats: () => api.get("/bookings/stats/").then((res) => res.data),
  updateBookingService: (bookingId, serviceId, payload) => api.patch(`/bookings/${bookingId}/services/${serviceId}/`, payload).then((res) => res.data),

  uploadTravelerIdProof: (travelerId, file) => {
    const formData = new FormData();
    formData.append("id_proof", file);
    // Same fix as packageApi.addImage — let the browser set the
    // multipart Content-Type + boundary itself.
    return api.post(`/bookings/travelers/${travelerId}/id-proof/`, formData).then((res) => res.data);
  },
};

export default bookingApi;
