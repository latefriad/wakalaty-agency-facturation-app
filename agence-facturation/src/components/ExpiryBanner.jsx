import { useLang } from "../i18n/LanguageContext";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ExpiryBanner() {
  const { t } = useLang();
  const { agency } = useAuth();

  if (!agency || agency.plan === "FREE") return null;

  const expires = agency.subscriptionExpires;
  if (!expires) return null;

  const expDate = expires?.toDate ? expires.toDate() : new Date(expires);
  const now = new Date();

  const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;

  // show only when expired or within last 7 days
  if (!isExpired && daysLeft > 7) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: isExpired ? "#ef4444" : "#f59e0b",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        zIndex: 500,
        direction: "inherit",
        maxWidth: "90vw",
      }}
    >
      {isExpired ? t("banner.expired") : t("banner.expiresIn", { days: daysLeft })}
      <Link
        to="/subscription"
        style={{
          background: "rgba(255,255,255,0.25)",
          color: "#fff",
          padding: "4px 14px",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isExpired ? t("banner.renewNow") : t("banner.renew")}
      </Link>
    </div>
  );
}

