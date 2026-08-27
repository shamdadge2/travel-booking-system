import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./tokenStorage";

function normalizeApiBaseUrl(raw) {
  if (!raw || !raw.trim()) return "http://127.0.0.1:8000/api";
  let url = raw.trim().replace(/\/+$/, "");
  // If user set https://host without /api, auto-append. Keeps /api/auth etc intact.
  if (!url.endsWith("/api")) url += "/api";
  return url;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the current access token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request fails with 401 (expired access token), try refreshing it
// once and replaying the original request. If the refresh itself fails
// (refresh token expired/blacklisted), clear tokens so the app treats
// the user as logged out — ProtectedRoute/AdminRoute then redirect
// naturally on the next render.
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh on the auth endpoints themselves.
    if (originalRequest.url?.includes("/auth/login/") || originalRequest.url?.includes("/auth/refresh/")) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request already triggered a refresh — wait for it
      // instead of firing a second refresh call.
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
        refresh: refreshToken,
      });
      setTokens({ access: data.access, refresh: data.refresh });
      resolveQueue(null, data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      resolveQueue(refreshError, null);
      clearTokens();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
