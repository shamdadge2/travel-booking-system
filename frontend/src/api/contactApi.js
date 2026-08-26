import api from "./axios";

const contactApi = {
  send: (payload) => api.post("/contact/", payload).then((res) => res.data),
  listMessages: (params) => api.get("/contact/messages/", { params }).then((res) => res.data),
  updateMessage: (id, payload) =>
    api.patch(`/contact/messages/${id}/`, payload).then((res) => res.data),
  removeMessage: (id) => api.delete(`/contact/messages/${id}/`).then((res) => res.data),
};

export default contactApi;
