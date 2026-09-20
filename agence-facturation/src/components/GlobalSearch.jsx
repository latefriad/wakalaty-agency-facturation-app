import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../i18n/LanguageContext";
import { api } from "../services/api";

// Recherche globale (clients / factures / contrats) accessible depuis toutes
// les pages du back-office. Résultats groupés en menu déroulant, navigation
// au clic vers la ressource.
export default function GlobalSearch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const r = await api.get("/search", { q: term });
        setRes(r.data);
        setOpen(true);
      } catch { /* silencieux */ } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (path) => { setOpen(false); setQ(""); setRes(null); navigate(path); };

  const total = res ? res.clients.length + res.invoices.length + res.contracts.length : 0;

  return (
    <div ref={boxRef} style={{ position: "relative", maxWidth: 460, margin: "0 0 16px" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => res && setOpen(true)}
        placeholder={t("search.placeholder")}
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fff" }}
      />
      {open && res && (
        <div style={{ position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, marginTop: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 12px 32px -8px rgba(15,23,42,.2)", zIndex: 900, maxHeight: 420, overflowY: "auto" }}>
          {total === 0 && !loading && (
            <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>{t("common.noResults")}</div>
          )}
          {res.clients.length > 0 && <Group title={t("search.clients")} />}
          {res.clients.map((c) => (
            <Item key={c.id} icon="👤" onClick={() => go(`/clients/${c.id}`)} title={c.name} subtitle={c.company || c.email} />
          ))}
          {res.invoices.length > 0 && <Group title={t("search.invoices")} />}
          {res.invoices.map((i) => (
            <Item key={i.id} icon="🧾" onClick={() => go("/invoices")} title={i.number || t("inv.draftLabel")} subtitle={`${i.client?.name || ""} · ${(i.total || 0).toLocaleString("fr-DZ")} ${t("common.currency")}`} />
          ))}
          {res.contracts.length > 0 && <Group title={t("search.contracts")} />}
          {res.contracts.map((c) => (
            <Item key={c.id} icon="📄" onClick={() => go("/contracts")} title={c.title} subtitle={c.client?.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title }) {
  return <div style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</div>;
}

function Item({ icon, title, subtitle, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
      </div>
    </div>
  );
}
