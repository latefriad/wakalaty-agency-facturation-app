import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang, LanguageSwitcher } from "../i18n/LanguageContext";
import { useTheme } from "../i18n/ThemeContext";



const ADMIN_MENU = [
  {
    title: "Général",
    items: [
      { path: "/dashboard", key: "nav.dashboard", icon: "📊" },
      { path: "/benefits", key: "nav.benefits", icon: "💰" },
    ]
  },
  {
    title: "CRM & Ventes",
    items: [
      { path: "/leads", key: "nav.leads", icon: "🎯" },
      { path: "/clients", key: "nav.clients", icon: "👥" },
      { path: "/client-reports", key: "nav.clientReports", icon: "📑" },
      { path: "/contracts", key: "nav.contracts", icon: "📄" },
    ]
  },
  {
    title: "Finance",
    items: [
      { path: "/invoices", key: "nav.invoices", icon: "🧾" },
      { path: "/expenses", key: "nav.expenses", icon: "💸" },
    ]
  },
  {
    title: "Opérations & Projets",
    items: [
      { path: "/adspend", key: "nav.adspend", icon: "📈" },
      { path: "/tasks", key: "nav.tasks", icon: "📋" },
      { path: "/project-templates", key: "nav.projectTemplates", icon: "📐" },
    ]
  },
  {
    title: "Gestion & Équipe",
    items: [
      { path: "/services", key: "nav.services", icon: "⚙️" },
      { path: "/suppliers", key: "nav.suppliers", icon: "🚚" },
      { path: "/employees", key: "nav.employees", icon: "👤" },
    ]
  },
  {
    title: "Configuration",
    items: [
      { path: "/settings", key: "nav.settings", icon: "⚙️" },
    ]
  }
];

const ACCOUNTANT_MENU = [
  {
    title: "Général",
    items: [
      { path: "/dashboard", key: "nav.dashboard", icon: "📊" },
    ]
  },
  {
    title: "CRM & Ventes",
    items: [
      { path: "/leads", key: "nav.leads", icon: "🎯" },
      { path: "/clients", key: "nav.clients", icon: "👥" },
      { path: "/client-reports", key: "nav.clientReports", icon: "📑" },
    ]
  },
  {
    title: "Finance",
    items: [
      { path: "/invoices", key: "nav.invoices", icon: "🧾" },
      { path: "/expenses", key: "nav.expenses", icon: "💸" },
    ]
  },
  {
    title: "Opérations",
    items: [
      { path: "/adspend", key: "nav.adspend", icon: "📈" },
      { path: "/suppliers", key: "nav.suppliers", icon: "🚚" },
    ]
  }
];

const ADS_MENU = [
  {
    title: "Général",
    items: [
      { path: "/dashboard", key: "nav.dashboard", icon: "📊" },
    ]
  },
  {
    title: "CRM & Ventes",
    items: [
      { path: "/leads", key: "nav.leads", icon: "🎯" },
      { path: "/clients", key: "nav.clients", icon: "👥" },
      { path: "/client-reports", key: "nav.clientReports", icon: "📑" },
    ]
  },
  {
    title: "Opérations & Ads",
    items: [
      { path: "/adspend", key: "nav.adspend", icon: "📈" },
    ]
  },
  {
    title: "Projets",
    items: [
      { path: "/tasks", key: "nav.tasks", icon: "📋" },
      { path: "/project-templates", key: "nav.projectTemplates", icon: "📐" },
    ]
  }
];

const DESIGNER_MENU = [
  {
    title: "Projets",
    items: [
      { path: "/tasks", key: "nav.tasks", icon: "📋" },
      { path: "/project-templates", key: "nav.projectTemplates", icon: "📐" },
      { path: "/my-dashboard", key: "nav.myDashboard", icon: "🏠" },
    ]
  }
];

const EMPLOYEE_MENU = [
  {
    title: "Menu",
    items: [
      { path: "/my-dashboard", key: "nav.myDashboard", icon: "🏠" },
    ]
  }
];

export default function Sidebar() {
  const { profile, agency, logout } = useAuth();
  const { t, dir } = useLang();
  const { isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const navigate = useNavigate();

  const primary = agency?.primaryColor || "#1e293b";
  const secondary = agency?.secondaryColor || "#334155";

  const isAdmin = profile?.role === "ADMIN";
  const isAccountant = profile?.role === "ACCOUNTANT";
  const isAds = profile?.role === "ADS";
  const isDesigner = profile?.role === "DESIGNER";

  const menuItems = isAdmin
    ? ADMIN_MENU
    : isAccountant
    ? ACCOUNTANT_MENU
    : isAds
    ? ADS_MENU
    : isDesigner
    ? DESIGNER_MENU
    : EMPLOYEE_MENU;



  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = () => (
    <aside
      style={{
        width: 260,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #090e17 0%, #0f172a 100%)",
        borderInlineEnd: "1px solid rgba(255, 255, 255, 0.08)",
        direction: "inherit",
      }}
    >
      {/* Agency Header */}
      <div
        style={{
          padding: "20px 18px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {agency?.logo ? (
              <img
                src={agency.logo}
                alt=""
                style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              "🏢"
            )}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--bg-card)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-0.01em",
              }}
            >
              {agency?.name || t("auth.defaultAgency")}
            </div>
            <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2, fontWeight: 500 }}>
              {t("common.agencyWorkspace") || "Espace Agence"}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {menuItems.map((group, gIdx) => (
          <div key={group.title || gIdx} style={{ marginBottom: 8 }}>
            {group.title && (
              <div 
                onClick={() => setCollapsedSections(prev => ({ ...prev, [group.title]: !prev[group.title] }))}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: "var(--text-muted)", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.06em",
                  marginTop: gIdx === 0 ? 4 : 16,
                  marginBottom: 8, 
                  paddingInlineStart: 12,
                  paddingInlineEnd: 12,
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <span>{group.title}</span>
                <span style={{ fontSize: 10, transition: "transform 0.2s", transform: collapsedSections[group.title] ? "rotate(-90deg)" : "rotate(0deg)" }}>
                  ▼
                </span>
              </div>
            )}
            
            <div style={{ 
              display: collapsedSections[group.title] ? "none" : "flex", 
              flexDirection: "column",
              gap: 4
            }}>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: isActive ? "#fff" : "rgba(255, 255, 255, 0.65)",
                    background: isActive ? "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.05) 100%)" : "transparent",
                    border: isActive ? "1px solid rgba(99, 102, 241, 0.2)" : "1px solid transparent",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: isActive
                            ? "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0.12) 100%)"
                            : "rgba(255, 255, 255, 0.04)",
                          color: isActive ? "var(--primary-color)" : "inherit",
                          border: isActive
                            ? "1px solid rgba(99, 102, 241, 0.2)"
                            : "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                      </div>
                      <span style={{ fontSize: 14 }}>{t(item.key)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
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
              color: "var(--bg-card)",
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
                color: "var(--bg-card)",
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
              color: "var(--bg-card)",
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
      <div className="mobile-topbar">
        <span className="mobile-topbar-title">
          <span style={{ fontSize: 18 }}>🏢</span>
          <span>{agency?.name || t("auth.defaultAgency")}</span>
        </span>
        <button className="hamburger-btn" onClick={() => setOpen(!open)} aria-label="Toggle Menu">
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} style={{ display: "block" }} />}

      {/* Sidebar Drawer */}
      <div
        className="app-sidebar-wrap"
        style={{
          position: "fixed",
          ...(dir === "rtl" ? { right: 0 } : { left: 0 }),
          top: 0,
          zIndex: 1001,
          transform: open ? "translateX(0)" : dir === "rtl" ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "0 0 50px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <SidebarInner />
      </div>

      {/* Always show on desktop */}
      <style>{`
        @media (min-width: 1025px) {
          .mobile-topbar { display: none !important; }
          .sidebar-overlay { display: none !important; }
          .app-sidebar-wrap {
            transform: translateX(0) !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
}

