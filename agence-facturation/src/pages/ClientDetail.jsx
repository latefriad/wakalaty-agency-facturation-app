import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import { getClientOverview, addClientNote, deleteClientNote } from "../services/clientsService";

const fmt = (n) => (n || 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INV_STATUS_COLOR = {
  DRAFT: "var(--text-muted)", SENT: "#0ea5e9", VUE: "#6366f1", EN_ATTENTE: "var(--warning)",
  EN_RETARD: "var(--danger)", PAYEE: "var(--success)", ANNULEE: "var(--danger)",
};

// Icône + couleur par type d'événement de la timeline.
const EVENT_META = {
  CLIENT_CREATED: { icon: "👤", color: "#6366f1" },
  INVOICE_ISSUED: { icon: "🧾", color: "var(--primary-color)" },
  INVOICE_SENT: { icon: "✉️", color: "#0ea5e9" },
  INVOICE_PAID: { icon: "✅", color: "var(--success)" },
  CONTRACT_SIGNED: { icon: "📄", color: "#8b5cf6" },
  TASK_CREATED: { icon: "📋", color: "var(--warning)" },
  NOTE_ADDED: { icon: "📝", color: "var(--text-muted)" },
};

export default function ClientDetail() {
  const { id } = useParams();
  const { t, dir } = useLang();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timeline");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return getClientOverview(id)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAddNote = async () => {
    const content = noteText.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      await addClientNote(id, content);
      setNoteText("");
      await load();
      toast.success(t("cd.noteAdded"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!(await confirm(t("cd.noteDeleteConfirm")))) return;
    try {
      await deleteClientNote(id, noteId);
      await load();
      toast.success(t("common.deleted"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>{t("common.loading")}</div>;
  if (!data) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>{t("clients.notFound")}</div>;

  const e = data.encours || {};
  const cards = [
    { label: t("cd.invoiced"), value: e.invoiced, color: "#6366f1", icon: "🧾" },
    { label: t("cd.paid"), value: e.paid, color: "var(--success)", icon: "✅" },
    { label: t("cd.due"), value: e.due, color: "var(--warning)", icon: "⏳" },
    { label: t("cd.overdue"), value: e.overdue, color: "var(--danger)", icon: "⚠️" },
  ];

  const tabs = [
    { key: "timeline", label: `📈 ${t("cd.timeline")}` },
    { key: "invoices", label: `${t("cd.invoices")} (${data.counts?.invoices ?? 0})` },
    { key: "contracts", label: `${t("cd.contracts")} (${data.counts?.contracts ?? 0})` },
    { key: "tasks", label: `${t("cd.tasks")} (${data.counts?.tasks ?? 0})` },
    { key: "notes", label: `📝 ${t("cd.notes")} (${data.counts?.notes ?? 0})` },
  ];

  const fmtDate = (d) => new Date(d).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <button onClick={() => navigate("/clients")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, marginBottom: 12, padding: 0 }}>
        {dir === "rtl" ? "→" : "←"} {t("cd.backToClients")}
      </button>

      {/* En-tête client */}
      <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "20px 24px", border: "1px solid var(--border-color)", marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{data.name}</h1>
            {data.company && <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{data.company}</div>}
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
              {[data.email, data.phone].filter(Boolean).join(" · ")}
            </div>
            {data.tags && data.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {data.tags.map((tag) => (
                  <span key={tag} style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>🏷️ {tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {data.customFields && Object.keys(data.customFields).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            {Object.entries(data.customFields).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, color: "var(--text-main)" }}>{String(v)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Encours financier */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--bg-card)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{fmt(c.value)} {t("common.currency")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{c.icon} {c.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === tb.key ? "#3b82f6" : "var(--bg-hover)", color: tab === tb.key ? "#fff" : "var(--text-muted)" }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div style={{ position: "relative" }}>
          {data.timeline.length === 0 && <Empty t={t} />}
          {data.timeline.map((ev, i) => {
            const m = EVENT_META[ev.type] || EVENT_META.NOTE_ADDED;
            return (
              <div key={ev.kind + ev.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: i === data.timeline.length - 1 ? 0 : 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{m.icon}</div>
                  {i < data.timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: "var(--border-color)", marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: m.color }}>{t(`ev.${ev.type}`)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(ev.createdAt)}</span>
                  </div>
                  {ev.message && <div style={{ fontSize: 13, color: "var(--text-main)", marginTop: 3, whiteSpace: "pre-wrap" }}>{ev.message}</div>}
                  {ev.kind === "note" && (
                    <button onClick={() => handleDeleteNote(ev.id)} style={{ marginTop: 6, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, padding: 0 }}>🗑️ {t("common.delete")}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "notes" && (
        <div>
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 14, border: "1px solid var(--border-color)", marginBottom: 12 }}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("cd.notePlaceholder")}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--primary-color)", color: "var(--bg-card)", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: savingNote || !noteText.trim() ? 0.6 : 1 }}>
                {savingNote ? t("common.saving") : t("cd.addNote")}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.notes.length === 0 && <Empty t={t} />}
            {data.notes.map((n) => (
              <div key={n.id} style={{ background: "var(--bg-card)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: 14, color: "var(--text-main)", whiteSpace: "pre-wrap" }}>{n.content}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                  <span>{[n.authorName, fmtDate(n.createdAt)].filter(Boolean).join(" · ")}</span>
                  <button onClick={() => handleDeleteNote(n.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, padding: 0 }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.invoices.length === 0 && <Empty t={t} />}
          {data.invoices.map((inv) => {
            const st = inv.isOverdue ? "EN_RETARD" : inv.status;
            return (
              <Row key={inv.id} onClick={() => navigate("/invoices")}>
                <div>
                  <span style={{ fontWeight: 700 }}>{inv.number || t("inv.draftLabel")}</span>
                  <span style={{ marginInlineStart: 8, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, color: INV_STATUS_COLOR[st] || "#64748b", background: (INV_STATUS_COLOR[st] || "#64748b") + "22" }}>
                    {t(`status.${st}`)}
                  </span>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(inv.createdAt).toLocaleDateString("fr-DZ")}{inv.dueDate ? ` · ${t("inv.dueDate")}: ${new Date(inv.dueDate).toLocaleDateString("fr-DZ")}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: dir === "rtl" ? "right" : "left" }}>
                  <div style={{ fontWeight: 700 }}>{fmt(inv.total)} {t("common.currency")}</div>
                  {inv.balance > 0 && inv.balance < inv.total && <div style={{ fontSize: 12, color: "var(--warning)" }}>{t("inv.remaining")}: {fmt(inv.balance)}</div>}
                </div>
              </Row>
            );
          })}
        </div>
      )}

      {tab === "contracts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.contracts.length === 0 && <Empty t={t} />}
          {data.contracts.map((c) => (
            <Row key={c.id} onClick={() => navigate("/contracts")}>
              <div>
                <span style={{ fontWeight: 700 }}>{c.title}</span>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.type} · {c.status}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{fmt(c.value)} {t("common.currency")}</div>
            </Row>
          ))}
        </div>
      )}

      {tab === "tasks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => navigate(`/tasks?client=${id}`)}
            style={{
              alignSelf: "flex-start", padding: "7px 14px", borderRadius: 9,
              border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            📋 {t("clients.viewTasks")}
          </button>
          {data.tasks.length === 0 && <Empty t={t} />}
          {data.tasks.map((tk) => (
            <Row key={tk.id} onClick={() => navigate(`/tasks?client=${id}`)}>
              <div>
                <span style={{ fontWeight: 700 }}>{tk.title}</span>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {tk.status}{tk.dueDate ? ` · ${new Date(tk.dueDate).toLocaleDateString("fr-DZ")}` : ""}
                </div>
              </div>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ children, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "var(--bg-card)", borderRadius: 10, padding: "12px 18px", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}>
      {children}
    </div>
  );
}

function Empty({ t }) {
  return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: 10, border: "1px dashed var(--border-color)" }}>{t("cd.empty")}</div>;
}
