import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../helpers/AuthContext.jsx";

/** Redirects to /login if not authenticated. */
export function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/**
 * Restricts access to listed roles.
 * Usage: <RoleRoute roles={["owner","admin"]}><Page /></RoleRoute>
 */
export function RoleRoute({ roles, children, fallback = "/dashboard" }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}
