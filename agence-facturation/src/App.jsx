import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLang } from "./i18n/LanguageContext";
import { ThemeProvider } from "./i18n/ThemeContext";
import ProtectedRoute, { getDashboardForRole } from "./components/ProtectedRoute";
import AppToaster from "./components/AppToaster";
import { ConfirmProvider } from "./components/ConfirmProvider";

// Code splitting : chaque page est un chunk séparé — le visiteur du login
// ne télécharge pas les ~11k lignes du back-office.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const Help = lazy(() => import("./pages/Help"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Leads = lazy(() => import("./pages/Leads"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Services = lazy(() => import("./pages/Services"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Employees = lazy(() => import("./pages/Employees"));
const Contracts = lazy(() => import("./pages/Contracts"));
const AgencyProfile = lazy(() => import("./pages/AgencyProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const InvitationAccept = lazy(() => import("./pages/InvitationAccept"));

// Shared
import Sidebar from "./components/Sidebar";
import ExpiryBanner from "./components/ExpiryBanner";
import GlobalSearch from "./components/GlobalSearch";

import "./App.css";

import LoadingScreen from "./components/LoadingScreen";
import { EMPLOYEE_ROLES, ADMIN_ROLES, ACCOUNTANT_ROLES, LEADS_ROLES } from "./utils/constants";

/**
 * AppLayout — shared shell for admin + employee pages.
 * Renders Sidebar, ExpiryBanner, and the correct page based on URL.
 */
function AppLayout() {
  const { user, loading, agency, profile, logout } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    if (!loading && user && !profile) {
      const t = setTimeout(() => setProfileTimeout(true), 8000);
      return () => clearTimeout(t);
    }
  }, [loading, user, profile]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile && !profileTimeout) return <LoadingScreen />;
  if (!profile && profileTimeout) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: "#ef4444", marginBottom: 8 }}>{t("app.profileLoadError")}</h2>
        <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>{t("app.checkAndRetry")}</p>
        <button onClick={() => { setProfileTimeout(false); window.location.reload(); }} style={{ padding: "10px 24px", borderRadius: 10, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, marginLeft: 10 }}>
          {t("common.retry")}
        </button>
        <button onClick={logout} style={{ padding: "10px 24px", borderRadius: 10, background: "#f1f5f9", color: "#334155", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          {t("common.logout")}
        </button>
      </div>
    );
  }

  // Onboarding check (admin only)
  const needsOnboarding =
    profile.role === "ADMIN" &&
    agency &&
    agency.onboarded === false &&
    location.pathname !== "/onboarding";

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // ── Render the correct page based on URL ──
  const path = location.pathname;

  let page;
  // Fiche client 360° : /clients/:id (route paramétrée, hors switch exact).
  if (/^\/clients\/[^/]+$/.test(path)) {
    page = <ClientDetail />;
  } else
  switch (path) {
    // Admin
    case "/dashboard":           page = <Dashboard />; break;
    case "/leads":               page = <Leads />; break;
    case "/clients":             page = <Clients />; break;
    case "/invoices":            page = <Invoices />; break;
    case "/expenses":            page = <Expenses />; break;
    case "/suppliers":           page = <Suppliers />; break;
    case "/services":            page = <Services />; break;
    case "/tasks":               page = <Tasks />; break;
    case "/employees":           page = <Employees />; break;
    case "/contracts":           page = <Contracts />; break;
    case "/agency":              page = <AgencyProfile />; break;    case "/settings":            page = <Settings />; break;
    case "/portfolio":           page = <Portfolio />; break;
    // Employee
    case "/my-dashboard":        page = <EmployeeDashboard />; break;
    // Fallback
    default:
      return <Navigate to={getDashboardForRole(profile.role)} replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <ExpiryBanner />
        {profile.role !== "EMPLOYEE" && <GlobalSearch />}
        {page}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  const dashboardRedirect = getDashboardForRole(profile?.role);

  return (
    <Routes>
      {/* ═══════════════ PUBLIC ═══════════════ */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/aide" element={<Help />} />
      <Route path="/f/:token" element={<PublicInvoice />} />
      <Route path="/invitation/:token" element={<InvitationAccept />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* ═══════════════ AUTH ═══════════════ */}
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/dashboard" replace />} />
      {/* ═══════════════ ADMIN + COMPTABLE ═══════════════ */}
      <Route element={<ProtectedRoute allowedRoles={ACCOUNTANT_ROLES} />}>
        <Route path="/dashboard" element={<AppLayout />} />
        <Route path="/clients" element={<AppLayout />} />
        <Route path="/clients/:id" element={<AppLayout />} />
        <Route path="/invoices" element={<AppLayout />} />
        <Route path="/expenses" element={<AppLayout />} />
        <Route path="/suppliers" element={<AppLayout />} />
      </Route>

      {/* ═══════════════ LEADS CRM (ADMIN, ACCOUNTANT, ADS) ═══════════════ */}
      <Route element={<ProtectedRoute allowedRoles={LEADS_ROLES} />}>
        <Route path="/leads" element={<AppLayout />} />
      </Route>

      {/* ═══════════════ ADMIN ONLY ═══════════════ */}
      <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
        <Route path="/services" element={<AppLayout />} />
        <Route path="/tasks" element={<AppLayout />} />
        <Route path="/employees" element={<AppLayout />} />
        <Route path="/contracts" element={<AppLayout />} />
        <Route path="/agency" element={<AppLayout />} />        <Route path="/settings" element={<AppLayout />} />
        <Route path="/portfolio" element={<AppLayout />} />
      </Route>

      {/* ═══════════════ EMPLOYEE ONLY ═══════════════ */}
      <Route element={<ProtectedRoute allowedRoles={EMPLOYEE_ROLES} />}>
        <Route path="/my-dashboard" element={<AppLayout />} />
      </Route>

      {/* ═══════════════ FALLBACK ═══════════════ */}
      <Route path="*" element={<Navigate to={dashboardRedirect} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ConfirmProvider>
              <AppToaster />
              <Suspense fallback={<LoadingScreen />}>
                <AppRoutes />
              </Suspense>
            </ConfirmProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
