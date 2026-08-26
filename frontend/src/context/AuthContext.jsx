import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContextObject";
import authApi from "../api/authApi";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../api/tokenStorage";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // isInitializing covers the brief window on first page load where we
  // don't yet know if a stored token is still valid. Route guards wait
  // for this to finish before deciding whether to redirect to /login —
  // otherwise a logged-in user refreshing the page would flash to the
  // login screen for a moment before their session is confirmed.
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsInitializing(false);
      return;
    }

    authApi
      .getProfile()
      .then((profile) => setUser(profile))
      .catch(() => {
        // Access token invalid/expired and refresh also failed (the
        // axios interceptor already tried) — treat as logged out.
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsInitializing(false));
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(credentials);
      setTokens(data.tokens);
      setUser(data.user);
      return { success: true };
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.non_field_errors?.[0] ||
        "Login failed. Please check your credentials.";
      return { success: false, error: detail };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken) => {
    setIsLoading(true);
    try {
      const data = await authApi.googleLogin(idToken);
      setTokens(data.tokens);
      setUser(data.user);
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail || "Google sign-in failed. Please try again.";
      return { success: false, error: detail };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (details) => {
    setIsLoading(true);
    try {
      const data = await authApi.register(details);
      setTokens(data.tokens);
      setUser(data.user);
      return { success: true };
    } catch (error) {
      const errors = error.response?.data;
      const firstError =
        typeof errors === "object" && errors !== null
          ? Object.values(errors)[0]
          : "Registration failed.";
      const message = Array.isArray(firstError) ? firstError[0] : firstError;
      return { success: false, error: message || "Registration failed." };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const refresh = getRefreshToken();
    if (refresh) {
      // Best-effort — we clear local state regardless of whether this
      // network call succeeds, so the user is never stuck "logged in"
      // locally just because the blacklist request failed.
      authApi.logout(refresh).catch(() => {});
    }
    clearTokens();
    setUser(null);
  };

  const refreshProfile = async () => {
    const profile = await authApi.getProfile();
    setUser(profile);
    return profile;
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",
    isStaffOrAdmin: user?.role === "admin" || user?.role === "staff",
    isLoading,
    isInitializing,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
