import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang, LanguageSwitcher } from "../i18n/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardForRole } from "../components/ProtectedRoute";

export default function Login() {
  const { login, agency } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const primary = agency?.primaryColor || "#3b82f6";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { profile: prof } = await login(email, password);

      // Redirect based on role (use fresh profile from login, not stale state)
      navigate(getDashboardForRole(prof?.role));
    } catch {
      setError(t("auth.badCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        direction: "inherit",
        background: `linear-gradient(135deg, ${primary}11, ${primary}22)`,
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "clamp(24px,5vw,40px)",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              margin: "0 auto 12px",
              background: `linear-gradient(135deg, ${primary}, ${primary}99)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🏢
          </div>
          <h1 style={{ fontSize: "clamp(18px,4vw,22px)", fontWeight: 700, margin: 0 }}>
            {agency?.name || t("auth.defaultAgency")}
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t("common.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@agence.com"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t("auth.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#dc2626",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 10,
              background: primary,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 15,
              opacity: loading ? 0.7 : 1,
              marginBottom: 14,
            }}
          >
            {loading ? t("auth.loggingIn") : t("auth.loginBtn")}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <LanguageSwitcher />
        </div>

        <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, margin: 0 }}>
          {t("auth.newAgency")}{" "}
          <Link
            to="/register"
            style={{ color: primary, fontWeight: 600, textDecoration: "none" }}
          >
            {t("auth.createFree")}
          </Link>
        </p>
      </div>
    </div>
  );
}


