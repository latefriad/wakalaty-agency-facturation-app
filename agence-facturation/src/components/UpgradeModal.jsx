import { Link } from "react-router-dom";
import { useLang } from "../i18n/LanguageContext";

export default function UpgradeModal({ resource, limit, onClose }) {
  const { t } = useLang();
  const messages = {
    clients: t("upg.limitClients", { limit }),
    invoices: t("upg.limitInvoices", { limit }),
    employees: t("upg.limitEmployees", { limit }),
    tasks: t("upg.limitTasks", { limit }),
    contracts: t("upg.limitContracts", { limit }),
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 32,
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          direction: "inherit",
          fontFamily: "'Segoe UI',Tahoma,sans-serif",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: "0 0 12px",
            color: "#1e293b",
          }}
        >
          {t("upg.title")}
        </h2>
        <p
          style={{
            color: "#64748b",
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          {messages[resource] || t("upg.limitGeneric")}
          <br />{t("upg.upgradeToPro")}
        </p>

        <div
          style={{
            background: "#eff6ff",
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1d4ed8",
              marginBottom: 10,
            }}
          >
            {t("upg.proIncludes")}
          </div>
          {[
            t("upg.f1"),
            t("upg.f2"),
            t("upg.f3"),
            t("upg.f4"),
            t("upg.f5"),
          ].map((f) => (
            <div
              key={f}
              style={{
                fontSize: 12,
                color: "#1d4ed8",
                marginBottom: 4,
              }}
            >
              ✓ {f}
            </div>
          ))}
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#1d4ed8",
              marginTop: 10,
            }}
          >
            {t("upg.pricePerMonth")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            to="/pricing"
            style={{
              flex: 2,
              display: "block",
              padding: "12px 0",
              borderRadius: 10,
              background: "#3b82f6",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {t("upg.upgradeNow")}
          </Link>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 10,
              background: "#f1f5f9",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "'Segoe UI',Tahoma,sans-serif",
            }}
          >
            {t("upg.later")}
          </button>
        </div>
      </div>
    </div>
  );
}

