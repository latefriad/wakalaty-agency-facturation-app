import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./LoadingScreen";
import { EMPLOYEE_ROLES } from "../utils/constants";

/**
 * ProtectedRoute
 *
 * Props:
 *   allowedRoles — array of role strings allowed to access the route.
 *                  If omitted, any authenticated user is allowed.
 *
 * Behavior:
 *   1. Loading  → show loading screen
 *   2. No user  → redirect to /login
 *   3. Wrong role → redirect to the correct dashboard
 *   4. OK       → render child routes via <Outlet />
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  // ── Not logged in ──
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── No profile yet (shouldn't happen, but guard) ──
  if (!profile) return <LoadingScreen />;

  const role = profile.role;

  // ── Role check ──
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to the correct place for their role
    if (EMPLOYEE_ROLES.includes(role)) return <Navigate to="/my-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

/**
 * Helper: returns the correct dashboard path for a given role.
 */
export function getDashboardForRole(role) {
  if (role === "ADMIN" || role === "ACCOUNTANT") return "/dashboard";
  return "/my-dashboard";
}
