import { useLang } from "../i18n/LanguageContext";

export default function Pagination({ pagination, page, onChange }) {
  const { t } = useLang();
  if (!pagination || pagination.pages <= 1) return null;

  const { pages, total } = pagination;

  const btn = (disabled) => ({
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 13,
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        marginTop: 24,
        direction: "inherit",
      }}
    >
      <button style={btn(page <= 1)} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t("common.previous")}
      </button>
      <span style={{ fontSize: 13, color: "#64748b" }}>
        {t("common.pageOf", { page, pages, total })}
      </span>
      <button style={btn(page >= pages)} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        {t("common.next")}
      </button>
    </div>
  );
}
