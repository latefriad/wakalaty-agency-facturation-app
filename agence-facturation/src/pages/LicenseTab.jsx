import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useLang } from "../i18n/LanguageContext";
import toast from "react-hot-toast";

const STATUS_STYLE = {
  ACTIVE: { color: "#059669", bg: "#d1fae5", icon: "✅" },
  SUSPENDED: { color: "#b45309", bg: "#fef3c7", icon: "⏸️" },
  REVOKED: { color: "#dc2626", bg: "#fee2e2", icon: "⛔" },
  EXPIRED: { color: "#dc2626", bg: "#fee2e2", icon: "⚠️" },
};

export default function LicenseTab() {
  const { t } = useLang();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStatus((await api.get("/license/status")).data);
    } catch (err) {
      // 503 = module licences non configuré côté serveur : on masque l'onglet.
      setStatus({ disabled: err.message?.includes("configuré") });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activate = async () => {
    if (!key.trim()) return toast.error(t("license.keyRequired"));
    setActivating(true);
    try {
      const res = await api.post("/license/activate", { licenseKey: key.trim() });
      toast.success(t("license.activated", { plan: res.data.plan }));
      setKey("");
      await load();
    } catch (err) {
      // Message traduit à partir du code serveur, sinon message brut en repli.
      const key = `license.err.${err.code}`;
      const translated = t(key);
      toast.error(translated === key ? err.message : translated);
    }
    setActivating(false);
  };

  if (loading) {
    return <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", color: "#64748b" }}>{t("common.loading")}</div>;
  }

  const hasLicense = status?.hasLicense;
  const st = hasLicense ? (STATUS_STYLE[status.status] || STATUS_STYLE.EXPIRED) : null;

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>🔑 {t("license.title")}</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>{t("license.subtitle")}</p>

      {hasLicense && (
        <div style={{ background: st.bg, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, color: st.color }}>
              {st.icon} {t(`license.status.${status.status}`)}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#64748b" }}>{status.keyPrefix}-••••</div>
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
            {t("license.plan")}: <b>{status.plan}</b>
            {status.expiresAt && <> · {t("license.expiresOn")} {new Date(status.expiresAt).toLocaleDateString()}</>}
          </div>
          {status.graceActive && (
            <div style={{ fontSize: 13, color: "#b45309", marginTop: 8 }}>⏳ {t("license.graceNote")}</div>
          )}
          {status.status === "REVOKED" && status.revokedReason && (
            <div style={{ fontSize: 13, color: "#991b1b", marginTop: 8 }}>{status.revokedReason}</div>
          )}
        </div>
      )}

      {/* On peut toujours (re)saisir une clé : renouvellement, changement de licence. */}
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {hasLicense ? t("license.enterNewKey") : t("license.enterKey")}
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="WKLY-XXXX-XXXX-XXXX-XXXX"
          style={{ flex: "1 1 260px", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 15, fontFamily: "monospace", letterSpacing: 1, outline: "none", direction: "ltr", textAlign: "left" }}
        />
        <button
          onClick={activate}
          disabled={activating}
          style={{ padding: "11px 24px", borderRadius: 9, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
        >
          {activating ? "…" : t("license.activate")}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>{t("license.hint")}</p>
    </div>
  );
}
