import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang, LanguageSwitcher } from "../i18n/LanguageContext";
import { useTheme } from "../i18n/ThemeContext";



const ADMIN_MENU = [
  { path: "/dashboard", key: "nav.dashboard", icon: "📊" },
  { path: "/clients", key: "nav.clients", icon: "👥" },
  { path: "/invoices", key: "nav.invoices", icon: "🧾" },
  { path: "/expenses", key: "nav.expenses", icon: "💸" },
  { path: "/suppliers", key: "nav.suppliers", icon: "🚚" },
  { path: "/contracts", key: "nav.contracts", icon: "📄" },
  { path: "/services", key: "nav.services", icon: "⚙️" },
  { path: "/service-proposals", key: "nav.proposals", icon: "🤖" },
  { path: "/tasks", key: "nav.tasks", icon: "📋" },
  { path: "/employees", key: "nav.employees", icon: "👤" },
  { path: "/portfolio", key: "nav.portfolio", icon: "📁" },
  { path: "/settings", key: "nav.settings", icon: "⚙️" },
];

const ACCOUNTANT_MENU = [
  { path: "/dashboard", key: "nav.dashboard", icon: "📊" },
  { path: "/clients", key: "nav.clients", icon: "👥" },
  { path: "/invoices", key: "nav.invoices", icon: "🧾" },
  { path: "/expenses", key: "nav.expenses", icon: "💸" },
  { path: "/suppliers", key: "nav.suppliers", icon: "🚚" },
];

const EMPLOYEE_MENU = [{ path: "/my-dashboard", key: "nav.myDashboard", icon: "🏠" }];

export default function Sidebar() {
  const { profile, agency, logout } = useAuth();
  const { t, dir } = useLang();
  const { isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const primary = agency?.primaryColor || "#1e293b";
  const secondary = agency?.secondaryColor || "#334155";

  const isAdmin = profile?.role === "ADMIN";
  const isAccountant = profile?.role === "ACCOUNTANT";

  const menuItems = isAdmin
    ? ADMIN_MENU
    : isAccountant
    ? ACCOUNTANT_MENU
    : EMPLOYEE_MENU;



  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = () => (
    <aside
      style={{
        width: 250,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg,${primary},${secondary})`,
        direction: "inherit",
      }}
    >
      {/* Agency Header */}
      <div
        style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {agency?.logo ? (
              <img
                src={agency.logo}
                alt=""
                style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }}
              />
            ) : (
              "🏢"
            )}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {agency?.name || t("auth.defaultAgency")}
            </div>          </div>

        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setOpen(false)}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              marginBottom: 2,
              borderRadius: 10,
              textDecoration: "none",
              color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
              background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              transition: "all 0.2s",
            })}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {profile?.name?.charAt(0) || "U"}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {profile?.name || t("common.user")}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              {isAdmin ? "👑 " + t("role.ADMIN") : isAccountant ? "🧮 " + t("role.ACCOUNTANT") : "👤 " + t("role.EMPLOYEE")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <LanguageSwitcher compact />
          <button
            onClick={toggle}
            title={isDark ? t("common.lightMode") : t("common.darkMode")}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
        <a
          href="/aide"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            width: "100%",
            padding: "8px 0",
            marginBottom: 8,
            borderRadius: 8,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.85)",
            textDecoration: "none",
            fontSize: 13,
            fontFamily: "'Segoe UI',Tahoma,sans-serif",
          }}
        >
          📘 {t("common.help")}
        </a>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "'Segoe UI',Tahoma,sans-serif",
          }}
        >
          🚪 {t("common.logout")}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar" style={{ background: primary }}>
        <span className="mobile-topbar-title">{agency?.name || t("auth.defaultAgency")}</span>
        <button className="hamburger-btn" onClick={() => setOpen(!open)}>
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <div
        className="app-sidebar-wrap"
        style={{
          position: "fixed",
          ...(dir === "rtl" ? { right: 0 } : { left: 0 }),
          top: 0,
          zIndex: 999,
          transform: open ? "translateX(0)" : dir === "rtl" ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.3s",
        }}
      >
        <SidebarInner />
      </div>

      {/* Always show on desktop — cible par classe (fiable). */}
      <style>{`
        @media (min-width:769px) {
          .mobile-topbar { display:none !important; }
          .app-sidebar-wrap { transform:translateX(0) !important; }
        }
      `}</style>
    </>
  );
}

