import { useState, useEffect } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import toast from "react-hot-toast";

const COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#1e293b",
  "#0f172a",
];

export default function AgencyProfile() {
  const { t } = useLang();
  const { agency, isAdmin } = useAuth();

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    primaryColor: "var(--primary-color)",
    secondaryColor: "#6366f1",
    logo: "",
    taxId: "",
    bankAccount: "",
    openingBalance: "0",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (agency) {
      setForm({
        name: agency.name || "",
        tagline: agency.tagline || "",
        email: agency.email || "",
        phone: agency.phone || "",
        address: agency.address || "",
        website: agency.website || "",
        primaryColor: agency.primaryColor || "#3b82f6",
        secondaryColor: agency.secondaryColor || "#6366f1",
        logo: agency.logo || "",
        taxId: agency.taxId || "",
        bankAccount: agency.bankAccount || "",
        openingBalance: String(agency.openingBalance ?? 0),
      });
    }
  }, [agency]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await api.post("/agencies/me/logo", formData);
      setForm((prev) => ({ ...prev, logo: res.data.logo }));
      toast.success(t("agency.logoUploaded"));
    } catch (err) {
      toast.error(err.message || t("agency.logoUploadError"));
    }
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.put("/agencies/me", { ...form, openingBalance: parseFloat(form.openingBalance) || 0 });
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
    border: "1.5px solid var(--border-color)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    direction: "inherit",
    textAlign: "right",
    color: "var(--text-main)",
    background: "var(--bg-card)",
    marginBottom: 14,
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  };

  return (
    <div
      style={{
        direction: "inherit",
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        maxWidth: 860,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, margin: 0 }}>
          {t("agency.title")}
        </h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
          {isAdmin ? t("agency.editSubtitle") : t("agency.viewSubtitle")}
        </p>
      </div>

      {/* Preview Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 24,
          color: "var(--bg-card)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 12,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {form.logo ? (
            <img
              src={form.logo}
              alt="logo"
              style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }}
            />
          ) : (
            "🏢"
          )}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{form.name || t("agency.namePlaceholder2")}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
            {form.tagline || t("agency.taglinePlaceholder2")}
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{form.email}</div>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* Basic Info */}
        <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 22, border: "1px solid var(--border-color)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600 }}>{t("agency.basicInfo")}</h3>

          <label style={labelStyle}>{t("agency.nameLabel")}</label>
          <input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder={t("auth.agencyNamePlaceholder")} style={inputStyle} />

          <label style={labelStyle}>{t("agency.tagline")}</label>
          <input value={form.tagline} onChange={(e) => handleChange("tagline", e.target.value)} placeholder={t("agency.taglineExample")} style={inputStyle} />

          <label style={labelStyle}>{t("common.email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="info@agence.com"
            style={inputStyle}
          />

          <label style={labelStyle}>{t("common.phone")}</label>
          <input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+213 555 000 000" style={inputStyle} />

          <label style={labelStyle}>{t("agency.website")}</label>
          <input value={form.website} onChange={(e) => handleChange("website", e.target.value)} placeholder="www.agence.com" style={inputStyle} />

          <label style={labelStyle}>{t("common.address")}</label>
          <input value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder={t("clients.addressPlaceholder")} style={inputStyle} />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Colors */}
          <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 22, border: "1px solid var(--border-color)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>{t("agency.colors")}</h3>

            <label style={labelStyle}>{t("agency.primaryColor")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => handleChange("primaryColor", c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: c,
                    cursor: "pointer",
                    border: form.primaryColor === c ? "3px solid #1e293b" : "2px solid transparent",
                    transform: form.primaryColor === c ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.1s",
                  }}
                />
              ))}
            </div>

            <label style={labelStyle}>{t("agency.secondaryColor")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => handleChange("secondaryColor", c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: c,
                    cursor: "pointer",
                    border: form.secondaryColor === c ? "3px solid #1e293b" : "2px solid transparent",
                    transform: form.secondaryColor === c ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.1s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Logo */}
          <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 22, border: "1px solid var(--border-color)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>{t("agency.logoSection")}</h3>

            {form.logo && (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={form.logo}
                  alt="logo preview"
                  style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
                />
              </div>
            )}

            <label
              style={{
                ...labelStyle,
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 8,
                background: "var(--primary-color)",
                color: "var(--bg-card)",
                cursor: "pointer",
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              {uploadingLogo ? t("agency.uploading") : t("agency.uploadLogo")}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: "none" }}
              />
            </label>

            <label style={labelStyle}>{t("agency.logoUrl")}</label>
            <input value={form.logo} onChange={(e) => handleChange("logo", e.target.value)} placeholder="https://example.com/logo.png" style={inputStyle} />
          </div>

          {/* Financial */}
          <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 22, border: "1px solid var(--border-color)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>{t("agency.financialInfo")}</h3>
            <label style={labelStyle}>{t("agency.taxId")}</label>
            <input value={form.taxId} onChange={(e) => handleChange("taxId", e.target.value)} placeholder="000 000 000 000" style={inputStyle} />
            <label style={labelStyle}>{t("agency.bankAccount")}</label>
            <input value={form.bankAccount} onChange={(e) => handleChange("bankAccount", e.target.value)} placeholder="CCP / RIB" style={inputStyle} />
            <label style={labelStyle}>{t("agency.openingBalance")}</label>
            <input type="number" step="0.01" value={form.openingBalance} onChange={(e) => handleChange("openingBalance", e.target.value)} placeholder="0.00" style={inputStyle} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -6, marginBottom: 10 }}>{t("agency.openingBalanceHint")}</div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "12px 32px",
            borderRadius: 10,
            background: form.primaryColor || "#3b82f6",
            color: "var(--bg-card)",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 15,
            minWidth: 160,
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
          }}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
