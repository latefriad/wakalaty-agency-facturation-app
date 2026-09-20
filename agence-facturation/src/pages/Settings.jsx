import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { api } from "../services/api";
import toast from "react-hot-toast";
import AgencyProfile from "./AgencyProfile";
import Subscription from "./Subscription";
import LicenseTab from "./LicenseTab";

const TABS = [
  { id: "profile", key: "settings.profileTab", icon: "👤" },
  { id: "password", key: "settings.passwordTab", icon: "🔒" },
  { id: "agency", key: "settings.agencyTab", icon: "🏢" },
  { id: "users", key: "settings.usersTab", icon: "👥", adminOnly: true },
  { id: "license", key: "settings.licenseTab", icon: "🔑", adminOnly: true },
  { id: "subscription", key: "settings.subscriptionTab", icon: "💳" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const { isAdmin } = useAuth();
  const { t } = useLang();
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div
      style={{
        direction: "inherit",
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        maxWidth: 960,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, margin: 0 }}>
          {t("settings.title")}
        </h1>
        <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 24,
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: 0,
          overflowX: "auto",
        }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 18px",
              borderRadius: "10px 10px 0 0",
              border: "none",
              background: activeTab === tab.id ? "#3b82f6" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#64748b",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "password" && <PasswordTab />}
      {activeTab === "agency" && <AgencyProfile />}
      {activeTab === "users" && isAdmin && <UsersTab />}
      {activeTab === "license" && isAdmin && <LicenseTab />}
      {activeTab === "subscription" && <Subscription />}
    </div>
  );
}

const ROLES = ["ADMIN", "ACCOUNTANT", "EMPLOYEE", "EDITOR", "DESIGNER", "ADS", "VIDEO", "SEO"];

function UsersTab() {
  const { profile } = useAuth();
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      toast.error(t("settings.usersLoadError"));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error(t("settings.allFieldsRequired"));
    }
    if (form.password.length < 8) {
      return toast.error(t("settings.passwordMin"));
    }
    setSaving(true);
    try {
      await api.post("/users", form);
      toast.success(t("settings.userCreated"));
      setForm({ name: "", email: "", password: "", role: "EMPLOYEE" });
      fetchUsers();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setSaving(false);
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      fetchUsers();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 9,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    direction: "inherit",
    background: "#fff",
    flex: "1 1 160px",
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>{t("settings.agencyUsers")}</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
        {t("settings.usersHint")}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        <input style={inputStyle} placeholder={t("common.name")} value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input style={{ ...inputStyle, direction: "ltr" }} type="email" placeholder="email@example.com" value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <input style={{ ...inputStyle, direction: "ltr" }} type="password" placeholder={t("settings.passwordPlaceholder")} value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        <select style={inputStyle} value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
          {ROLES.map((v) => (
            <option key={v} value={v}>{t(`role.${v}`)}</option>
          ))}
        </select>
        <button onClick={handleCreate} disabled={saving}
          style={{ padding: "10px 22px", borderRadius: 9, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
          {saving ? "..." : t("common.add")}
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#64748b", padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => (
            <div key={u.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 10, border: "1px solid #f1f5f9", background: u.isActive ? "#fff" : "#f8fafc", opacity: u.isActive ? 1 : 0.6, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {u.name} {u.id === profile?.id && <span style={{ color: "#94a3b8", fontSize: 12 }}>{t("settings.you")}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", direction: "ltr", textAlign: "right" }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: "#eff6ff", color: "#3b82f6" }}>
                  {t(`role.${u.role}`)}
                </span>
                {u.id !== profile?.id && u.role !==  && (
                  <button onClick={() => toggleActive(u)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, color: u.isActive ? "#ef4444" : "#10b981", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
                    {u.isActive ? t("settings.deactivate") : t("settings.activate")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const { profile, user } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || user?.email || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await api.put("/auth/me", { name: form.name, email: form.email });
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err.message || t("settings.saveError"));
    }
    setSaving(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 9,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    direction: "rtl",
    textAlign: "right",
    color: "#1e293b",
    background: "#fff",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600 }}>{t("settings.accountInfo")}</h3>

      <label style={labelStyle}>{t("settings.fullName")}</label>
      <input
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        placeholder={t("settings.enterName")}
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>{t("common.email")}</label>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        placeholder="email@example.com"
        style={inputStyle}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "11px 28px",
            borderRadius: 10,
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            minWidth: 140,
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
          }}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

function PasswordTab() {
  const { t } = useLang();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirm) {
      toast.error(t("settings.allFieldsRequired"));
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error(t("settings.passwordMin"));
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error(t("settings.passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success(t("settings.passwordChanged"));
    } catch (err) {
      toast.error(err.message || t("settings.passwordError"));
    }
    setSaving(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 9,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    direction: "rtl",
    textAlign: "right",
    color: "#1e293b",
    background: "#fff",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600 }}>{t("settings.changePassword")}</h3>

      <label style={labelStyle}>{t("settings.currentPassword")}</label>
      <input
        type="password"
        value={form.currentPassword}
        onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
        placeholder=""
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>{t("settings.newPassword")}</label>
      <input
        type="password"
        value={form.newPassword}
        onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
        placeholder=""
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 16 }}>{t("settings.confirmPassword")}</label>
      <input
        type="password"
        value={form.confirm}
        onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
        placeholder=""
        style={inputStyle}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "11px 28px",
            borderRadius: 10,
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            minWidth: 140,
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
          }}
        >
          {saving ? t("settings.changing") : t("settings.changePasswordBtn")}
        </button>
      </div>
    </div>
  );
}
