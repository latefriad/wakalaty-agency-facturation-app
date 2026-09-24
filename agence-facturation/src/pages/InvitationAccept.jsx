import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { api, setToken } from "../services/api";

// Page publique d'acceptation d'une invitation : l'invité définit son propre
// mot de passe (jamais transmis par e-mail), puis est connecté directement.
export default function InvitationAccept() {
  const { token } = useParams();
  const { t } = useLang();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get(`/auth/invitation/${token}`)
      .then((res) => mounted && setInfo(res.data))
      .catch((err) => mounted && setError(err.status === 410 ? t("invite.expired") : t("invite.invalid")))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("invite.passwordTooShort"));
    if (password !== confirm) return toast.error(t("invite.passwordMismatch"));
    setSaving(true);
    try {
      const res = await api.post(`/auth/invitation/${token}/accept`, { password });
      setToken(res.data.token);
      toast.success(t("invite.accountCreated"));
      // Rechargement complet : AuthContext relit /auth/me et route par rôle.
      window.location.href = "/";
    } catch (err) {
      setSaving(false);
      toast.error(err.status === 410 ? t("invite.expired") : err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)", fontFamily: "'Segoe UI',Tahoma,sans-serif", padding: 20 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", background: "var(--bg-card)", borderRadius: 16, padding: 28, boxShadow: "0 10px 30px rgba(2,6,23,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40 }}>✉️</div>
          <h1 style={{ fontSize: 20, margin: "8px 0 0" }}>{t("invite.title")}</h1>
        </div>

        {loading && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>{t("common.loading")}</div>}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 8 }}>{error}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("invite.askNewLink")}</div>
          </div>
        )}

        {!loading && info && (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 14, color: "var(--text-main)", textAlign: "center", margin: "0 0 20px" }}>
              <strong>{info.agencyName}</strong> {t("invite.invitesYou")}
            </p>

            <label className="form-label">{t("auth.emailLabel")}</label>
            <input value={info.email} disabled className="form-input" style={{ marginBottom: 14, background: "var(--bg-app)" }} />

            <label className="form-label">{t("invite.choosePassword")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              style={{ marginBottom: 14 }}
              autoFocus
            />

            <label className="form-label">{t("invite.confirmPassword")}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              style={{ marginBottom: 20 }}
            />

            <button type="submit" disabled={saving} className="btn-primary" style={{ width: "100%", padding: "12px 0", fontSize: 15 }}>
              {saving ? t("common.saving") : t("invite.createAccount")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
