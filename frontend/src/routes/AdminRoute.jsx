import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Loader from "../components/Loader";

export default function AdminRoute() {
  const { isAuthenticated, isStaffOrAdmin, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <Loader label="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isStaffOrAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
