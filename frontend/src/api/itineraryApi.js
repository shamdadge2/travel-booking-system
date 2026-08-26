import api from "./axios";

// NOTE: itineraries live under two different URL roots on the backend
// (nested under packages for list/create, flat for update/delete) —
// mirrored here exactly.
const itineraryApi = {
  listForPackage: (packageId) =>
    api.get(`/packages/${packageId}/itinerary/`).then((res) => res.data),
  createForPackage: (packageId, payload) =>
    api.post(`/packages/${packageId}/itinerary/`, payload).then((res) => res.data),
  update: (itineraryId, payload) =>
    api.patch(`/itinerary/${itineraryId}/`, payload).then((res) => res.data),
  remove: (itineraryId) => api.delete(`/itinerary/${itineraryId}/`).then((res) => res.data),
};

export default itineraryApi;
