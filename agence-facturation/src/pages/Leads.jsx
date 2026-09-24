import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { api } from "../services/api";
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  changeLeadStage,
  deleteLead,
  addLeadNote,
  convertLeadToClient,
} from "../services/leadsService";
import { normalizePhoneNumber } from "../components/WhatsAppReminderButton";

const STAGES = [
  { id: "NEW", key: "leadStage.NEW", color: "var(--primary-color)", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "CONTACTED", key: "leadStage.CONTACTED", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "QUOTE_SENT", key: "leadStage.QUOTE_SENT", color: "var(--warning)", bg: "rgba(245, 158, 11, 0.1)", border: "#fde68a" },
  { id: "NEGOTIATION", key: "leadStage.NEGOTIATION", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  { id: "WON", key: "leadStage.WON", color: "var(--success)", bg: "rgba(16, 185, 129, 0.1)", border: "#a7f3d0" },
  { id: "LOST", key: "leadStage.LOST", color: "var(--danger)", bg: "rgba(239, 68, 68, 0.1)", border: "#fecaca" },
];

const SOURCES = [
  { id: "WHATSAPP", key: "leadSource.WHATSAPP", icon: "💬", color: "#16a34a", bg: "#dcfce7" },
  { id: "ADS", key: "leadSource.ADS", icon: "📢", color: "var(--primary-color)", bg: "#dbeafe" },
  { id: "FORM", key: "leadSource.FORM", icon: "📋", color: "#9333ea", bg: "#f3e8ff" },
  { id: "CHATBOT", key: "leadSource.CHATBOT", icon: "🤖", color: "#0891b2", bg: "#cffafe" },
  { id: "REFERRAL", key: "leadSource.REFERRAL", icon: "👥", color: "#ca8a04", bg: "#fef08a" },
  { id: "OTHER", key: "leadSource.OTHER", icon: "🌐", color: "var(--text-main)", bg: "var(--bg-hover)" },
];

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  company: "",
  source: "WHATSAPP",
  stage: "NEW",
  estimatedValue: "",
  followUpDate: "",
  lostReason: "",
  notes: "",
  assignedToId: "",
};

export default function Leads() {
  const { profile, agency } = useAuth();
  const { t, lang } = useLang();
  const confirm = useConfirm();

  // State
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    wonCount: 0,
    conversionRate: 0,
    pipelineValue: 0,
    overdueCount: 0,
  });
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table"

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Modals & Drawers
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Detail Drawer
  const [selectedLead, setSelectedLead] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Drag & drop ref
  const dragLeadId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const agencyCurrency = agency?.currency || "DZD";

  // Check roles
  const userRole = profile?.role || "EMPLOYEE";
  const canAccess = ["ADMIN", "ACCOUNTANT", "ADS"].includes(userRole);

  // Fetch assignees
  const fetchAssignees = useCallback(async () => {
    try {
      const res = await api.get("/leads/assignees");
      setAssignees(res.data || []);
    } catch {
      // Fallback
    }
  }, []);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      const params = {
        all: "true",
        search: search || undefined,
        source: sourceFilter || undefined,
        assignee: assigneeFilter || undefined,
        overdue: onlyOverdue ? "true" : undefined,
      };
      const res = await getLeads(params);
      setLeads(res.data || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, assigneeFilter, onlyOverdue, t]);

  useEffect(() => {
    if (canAccess) {
      fetchAssignees();
      fetchLeads();
    }
  }, [canAccess, fetchAssignees, fetchLeads]);

  // Open Drawer with fresh details and notes
  const openDrawer = async (lead) => {
    setSelectedLead(lead);
    setDrawerLoading(true);
    try {
      const fresh = await getLead(lead.id);
      setSelectedLead(fresh);
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedLead(null);
    setNewNote("");
  };

  // Open Create / Edit Modal
  const openCreateModal = () => {
    setEditingLead(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      company: lead.company || "",
      source: lead.source || "WHATSAPP",
      stage: lead.stage || "NEW",
      estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : "",
      followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : "",
      lostReason: lead.lostReason || "",
      notes: lead.notes || "",
      assignedToId: lead.assignedToId || "",
    });
    setShowModal(true);
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("leads.name"));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone ? form.phone.trim() : null,
        email: form.email ? form.email.trim() : null,
        company: form.company ? form.company.trim() : null,
        source: form.source,
        stage: form.stage,
        estimatedValue: form.estimatedValue !== "" ? Number(form.estimatedValue) : null,
        followUpDate: form.followUpDate || null,
        lostReason: form.stage === "LOST" ? form.lostReason || null : null,
        notes: form.notes ? form.notes.trim() : null,
        assignedToId: form.assignedToId || null,
      };

      if (editingLead) {
        await updateLead(editingLead.id, payload);
        toast.success(t("leads.updated"));
      } else {
        await createLead(payload);
        toast.success(t("leads.created"));
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  // Move stage (via drag-and-drop or select dropdown)
  // If moved to WON → auto-convert to client immediately (no extra button needed)
  const handleMoveLead = async (leadId, targetStage) => {
    try {
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: targetStage } : l))
      );

      if (targetStage === "WON") {
        const lead = leads.find((l) => l.id === leadId);
        if (!lead?.convertedClientId) {
          try {
            const res = await convertLeadToClient(leadId);
            toast.success("✅ صفقة ناجحة! تم إضافته تلقائياً لقسم إدارة العملاء 🎉");
            fetchLeads();
            if (selectedLead && selectedLead.id === leadId) {
              setSelectedLead(res.lead);
            }
            return;
          } catch (convertErr) {
            toast.error(convertErr.message || t("common.error"));
          }
        } else {
          await changeLeadStage(leadId, targetStage);
          toast.success(t("leads.stageChanged"));
        }
      } else {
        await changeLeadStage(leadId, targetStage);
        toast.success(t("leads.stageChanged"));
      }

      fetchLeads();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev) => ({ ...prev, stage: targetStage }));
      }
    } catch (err) {
      toast.error(err.message || t("common.error"));
      fetchLeads();
    }
  };

  // Convert to Client
  const handleConvert = async (lead) => {
    if (lead.convertedClientId) {
      toast(t("leads.alreadyConverted"), { icon: "ℹ️" });
      return;
    }
    const ok = await confirm(t("leads.convertConfirm"));
    if (!ok) return;

    try {
      const res = await convertLeadToClient(lead.id);
      toast.success(t("leads.convertSuccess"));
      fetchLeads();
      if (selectedLead && selectedLead.id === lead.id) {
        setSelectedLead(res.lead);
      }
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  // Delete Lead
  const handleDelete = async (id) => {
    const ok = await confirm(t("leads.deleteConfirm"));
    if (!ok) return;

    try {
      await deleteLead(id);
      toast.success(t("leads.deleted"));
      if (selectedLead && selectedLead.id === id) {
        closeDrawer();
      }
      fetchLeads();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  // Add Note to Drawer
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedLead) return;

    setNoteSubmitting(true);
    try {
      const noteRes = await addLeadNote(selectedLead.id, newNote.trim());
      setNewNote("");
      toast.success(t("leads.noteAdded"));
      // Add to timeline
      setSelectedLead((prev) => ({
        ...prev,
        notesList: [noteRes, ...(prev.notesList || [])],
      }));
      fetchLeads();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Open WhatsApp Link
  const handleWhatsApp = (lead, e) => {
    if (e) e.stopPropagation();
    const clean = normalizePhoneNumber(lead.phone);
    if (!clean || clean.length < 8) {
      toast.error(t("inv.whatsappInvalidPhone"));
      return;
    }
    const agencyName = agency?.name || "Adpowers Digital";
    const msg =
      lang === "fr"
        ? `Bonjour ${lead.name}, nous faisons suite à votre demande auprès de ${agencyName}...`
        : `السلام عليكم ${lead.name}، نتواصل معك من فريق ${agencyName} بخصوص استفسارك...`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Group by stages for Kanban
  const groupedByStage = useMemo(() => {
    const map = {};
    STAGES.forEach((s) => (map[s.id] = []));
    leads.forEach((l) => {
      if (map[l.stage]) {
        map[l.stage].push(l);
      } else {
        map.NEW.push(l);
      }
    });
    return map;
  }, [leads]);

  if (!canAccess) {
    return (
      <div style={{ padding: 32, textAlign: "center", direction: "inherit" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2>{t("common.error")}</h2>
        <p style={{ color: "var(--text-muted)" }}>Accès restreint aux rôles ADMIN, ACCOUNTANT, ADS.</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div style={{ padding: "24px 28px", direction: "inherit", maxWidth: 1600, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🎯</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text-main)" }}>
              {t("leads.title")}
            </h1>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {t("leads.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* View Toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-hover)",
              borderRadius: 10,
              padding: 3,
              border: "1px solid var(--border-color)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "kanban" ? "#fff" : "transparent",
                color: viewMode === "kanban" ? "#0f172a" : "var(--text-muted)",
                boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              📋 {t("leads.kanbanView")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "table" ? "#fff" : "transparent",
                color: viewMode === "table" ? "#0f172a" : "var(--text-muted)",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              📑 {t("leads.listView")}
            </button>
          </div>

          {/* New Lead Button */}
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--primary-color)",
              color: "var(--bg-card)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
            }}
          >
            <span>{t("leads.newLead")}</span>
          </button>
        </div>
      </div>

      {/* ── Top Summary KPI Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#eff6ff",
              color: "var(--primary-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("leads.totalLeads")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>
              {stats.totalLeads}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("leads.conversionRate")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)" }}>
              {stats.conversionRate}%{" "}
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                ({stats.wonCount} {t("leadStage.WON")})
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fef3c7",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            💰
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("leads.pipelineValue")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
              {stats.pipelineValue.toLocaleString("fr-DZ")} {agencyCurrency}
            </div>
          </div>
        </div>

        <div
          style={{
            background: stats.overdueCount > 0 ? "#fff1f2" : "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: stats.overdueCount > 0 ? "1px solid #fecdd3" : "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: stats.overdueCount > 0 ? "#ffe4e6" : "var(--bg-hover)",
              color: stats.overdueCount > 0 ? "#e11d48" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ⚠️
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: stats.overdueCount > 0 ? "#e11d48" : "var(--text-muted)",
              }}
            >
              {t("leads.overdueFollowUps")}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: stats.overdueCount > 0 ? "#e11d48" : "var(--text-main)",
              }}
            >
              {stats.overdueCount}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          padding: "12px 18px",
          border: "1px solid var(--border-color)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Search */}
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("leads.searchPlaceholder")}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Source Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("leads.filterSource")}:
          </span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
            }}
          >
            <option value="">{t("leads.filterAllSources")}</option>
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {t(s.key)}
              </option>
            ))}
          </select>
        </div>

        {/* Assignee Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("leads.filterAssignee")}:
          </span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
            }}
          >
            <option value="">{t("leads.filterAllAssignees")}</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Only Overdue Filter */}
        <button
          type="button"
          onClick={() => setOnlyOverdue(!onlyOverdue)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: onlyOverdue ? "1px solid #fca5a5" : "1px solid #e2e8f0",
            background: onlyOverdue ? "#fee2e2" : "var(--bg-app)",
            color: onlyOverdue ? "#dc2626" : "var(--text-main)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            transition: "all 0.15s ease",
          }}
        >
          {t("leads.onlyOverdue")}
        </button>
      </div>

      {/* ── Main View: Kanban or Table ── */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div>{t("common.loading") || "Chargement..."}</div>
        </div>
      ) : viewMode === "kanban" ? (
        /* ── Kanban Board ── */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {STAGES.map((col) => {
            const colLeads = groupedByStage[col.id] || [];
            const isOver = dragOverCol === col.id;
            const colValue = colLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0);

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== col.id) setDragOverCol(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  if (dragLeadId.current) {
                    handleMoveLead(dragLeadId.current, col.id);
                  }
                }}
                style={{
                  background: isOver ? `${col.color}10` : "var(--bg-app)",
                  borderRadius: 14,
                  border: isOver ? `2px dashed ${col.color}` : "1px solid #e2e8f0",
                  padding: 12,
                  minHeight: 450,
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 10,
                    marginBottom: 10,
                    borderBottom: `2px solid ${col.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: col.color,
                      }}
                    />
                    <span style={{ fontWeight: 800, fontSize: 14, color: col.color }}>
                      {t(col.key)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 12,
                        background: col.bg,
                        color: col.color,
                        border: `1px solid ${col.border}`,
                      }}
                    >
                      {colLeads.length}
                    </span>
                  </div>

                  {colValue > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                      {colValue.toLocaleString("fr-DZ")} {agencyCurrency}
                    </span>
                  )}
                </div>

                {/* Cards Container */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {colLeads.length === 0 ? (
                    <div
                      style={{
                        padding: "24px 12px",
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        border: "1px dashed var(--border-color)",
                        borderRadius: 10,
                        margin: "10px 0",
                      }}
                    >
                      {t("leads.emptyStage")}
                    </div>
                  ) : (
                    colLeads.map((lead) => {
                      const sourceMeta =
                        SOURCES.find((s) => s.id === lead.source) || SOURCES[5];
                      const isOverdue =
                        lead.followUpDate &&
                        new Date(lead.followUpDate) < now &&
                        lead.stage !== "WON" &&
                        lead.stage !== "LOST";

                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", lead.id);
                            dragLeadId.current = lead.id;
                          }}
                          onClick={() => openDrawer(lead)}
                          style={{
                            background: "var(--bg-card)",
                            borderRadius: 12,
                            padding: "14px",
                            border: "1px solid var(--border-color)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            cursor: "grab",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = col.color;
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                          }}
                        >
                          {/* Card Top: Source Badge + Conversion / Action */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: sourceMeta.bg,
                                color: sourceMeta.color,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span>{sourceMeta.icon}</span>
                              <span>{t(sourceMeta.key)}</span>
                            </span>

                            {lead.convertedClientId ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "var(--success)",
                                  background: "rgba(16, 185, 129, 0.1)",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  border: "1px solid #a7f3d0",
                                }}
                              >
                                {t("leads.alreadyConverted")}
                              </span>
                            ) : null}
                          </div>

                          {/* Name & Company */}
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)", marginBottom: 2 }}>
                            {lead.name}
                          </div>
                          {lead.company && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                              🏢 {lead.company}
                            </div>
                          )}

                          {/* Value & Notes preview */}
                          {lead.estimatedValue > 0 && (
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "var(--success)",
                                marginBottom: 6,
                              }}
                            >
                              {lead.estimatedValue.toLocaleString("fr-DZ")} {agencyCurrency}
                            </div>
                          )}

                          {/* Follow-up date badge */}
                          {lead.followUpDate && (
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "3px 7px",
                                borderRadius: 6,
                                background: isOverdue ? "#fee2e2" : "var(--bg-hover)",
                                color: isOverdue ? "#dc2626" : "var(--text-main)",
                                border: isOverdue ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 8,
                              }}
                            >
                              <span>{isOverdue ? "⚠️" : "📅"}</span>
                              <span>
                                {t("leads.followUpDate")}:{" "}
                                {new Date(lead.followUpDate).toLocaleDateString("fr-DZ")}
                              </span>
                            </div>
                          )}

                          {/* Footer: Assignee & Action Buttons */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 6,
                              paddingTop: 8,
                              borderTop: "1px solid var(--border-color)",
                            }}
                          >
                            {/* Assignee */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: "50%",
                                  background: "var(--border-color)",
                                  color: "var(--text-main)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {lead.assignedTo?.name
                                  ? lead.assignedTo.name.charAt(0).toUpperCase()
                                  : "👤"}
                              </div>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {lead.assignedTo?.name || t("leads.chooseAssignee")}
                              </span>
                            </div>

                            {/* Quick Action Buttons */}
                            <div
                              style={{ display: "flex", alignItems: "center", gap: 4 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => handleWhatsApp(lead, e)}
                                  title={t("leads.contactWhatsApp")}
                                  style={{
                                    border: "1px solid #86efac",
                                    background: "#f0fdf4",
                                    color: "#16a34a",
                                    borderRadius: 6,
                                    padding: "4px 6px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  💬
                                </button>
                              )}

                              {!lead.convertedClientId && (
                                <button
                                  type="button"
                                  onClick={() => handleConvert(lead)}
                                  title={t("leads.convertToClient")}
                                  style={{
                                    border: "1px solid #a7f3d0",
                                    background: "rgba(16, 185, 129, 0.1)",
                                    color: "var(--success)",
                                    borderRadius: 6,
                                    padding: "4px 6px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  🤝
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openEditModal(lead)}
                                title={t("common.edit")}
                                style={{
                                  border: "1px solid var(--border-color)",
                                  background: "var(--bg-card)",
                                  borderRadius: 6,
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                          </div>

                          {/* Fallback stage selector (mobile / accessible) */}
                          <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={lead.stage}
                              onChange={(e) => handleMoveLead(lead.id, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: `1px solid ${col.border}`,
                                background: "var(--bg-card)",
                                fontSize: 11,
                                fontWeight: 700,
                                color: col.color,
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              {STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {t(s.key)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)", textAlign: "inherit" }}>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.name")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.source")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.stage")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.estimatedValue")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.followUpDate")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.assignedTo")}</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-main)" }}>{t("leads.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                    {t("leads.emptyList")}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const stageMeta = STAGES.find((s) => s.id === lead.stage) || STAGES[0];
                  const sourceMeta = SOURCES.find((s) => s.id === lead.source) || SOURCES[5];
                  const isOverdue =
                    lead.followUpDate &&
                    new Date(lead.followUpDate) < now &&
                    lead.stage !== "WON" &&
                    lead.stage !== "LOST";

                  return (
                    <tr
                      key={lead.id}
                      style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
                      onClick={() => openDrawer(lead)}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{lead.name}</div>
                        {lead.company && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{lead.company}</div>}
                        {lead.phone && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{lead.phone}</div>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: sourceMeta.bg,
                            color: sourceMeta.color,
                          }}
                        >
                          {sourceMeta.icon} {t(sourceMeta.key)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: stageMeta.bg,
                            color: stageMeta.color,
                            border: `1px solid ${stageMeta.border}`,
                          }}
                        >
                          {t(stageMeta.key)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--success)" }}>
                        {lead.estimatedValue != null
                          ? `${lead.estimatedValue.toLocaleString("fr-DZ")} ${agencyCurrency}`
                          : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {lead.followUpDate ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isOverdue ? "#dc2626" : "var(--text-main)",
                              background: isOverdue ? "#fee2e2" : "transparent",
                              padding: isOverdue ? "2px 6px" : "0",
                              borderRadius: 4,
                            }}
                          >
                            {isOverdue && "⚠️ "}
                            {new Date(lead.followUpDate).toLocaleDateString("fr-DZ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-main)" }}>
                        {lead.assignedTo?.name || "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {lead.phone && (
                            <button
                              type="button"
                              onClick={(e) => handleWhatsApp(lead, e)}
                              title={t("leads.contactWhatsApp")}
                              style={{
                                border: "1px solid #86efac",
                                background: "#f0fdf4",
                                color: "#16a34a",
                                borderRadius: 6,
                                padding: "5px 8px",
                                cursor: "pointer",
                              }}
                            >
                              💬
                            </button>
                          )}
                          {!lead.convertedClientId && (
                            <button
                              type="button"
                              onClick={() => handleConvert(lead)}
                              title={t("leads.convertToClient")}
                              style={{
                                border: "1px solid #a7f3d0",
                                background: "rgba(16, 185, 129, 0.1)",
                                color: "var(--success)",
                                borderRadius: 6,
                                padding: "5px 8px",
                                cursor: "pointer",
                              }}
                            >
                              🤝
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(lead)}
                            title={t("common.edit")}
                            style={{
                              border: "1px solid var(--border-color)",
                              background: "var(--bg-card)",
                              borderRadius: 6,
                              padding: "5px 8px",
                              cursor: "pointer",
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(lead.id)}
                            title={t("common.delete")}
                            style={{
                              border: "1px solid #fecaca",
                              background: "#fff5f5",
                              color: "var(--danger)",
                              borderRadius: 6,
                              padding: "5px 8px",
                              cursor: "pointer",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Drawer (Side-panel) ── */}
      {selectedLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            zIndex: 1100,
            display: "flex",
            justifyContent: lang === "ar" ? "flex-start" : "flex-end",
          }}
          onClick={closeDrawer}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              height: "100%",
              background: "var(--bg-card)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflowY: "auto",
              padding: 24,
              boxSizing: "border-box",
              direction: lang === "ar" ? "rtl" : "ltr",
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--border-color)",
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-main)" }}>
                  {selectedLead.name}
                </h2>
                {selectedLead.company && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    🏢 {selectedLead.company}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                style={{
                  border: "none",
                  background: "var(--bg-hover)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {drawerLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                ⏳ {t("common.loading") || "Chargement..."}
              </div>
            ) : (
              <>
                {/* Stage selector in Drawer */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    {t("leads.stage")}
                  </label>
                  <select
                    value={selectedLead.stage}
                    onChange={(e) => handleMoveLead(selectedLead.id, e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      fontWeight: 700,
                      outline: "none",
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Action Buttons */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  {selectedLead.phone && (
                    <button
                      type="button"
                      onClick={(e) => handleWhatsApp(selectedLead, e)}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#25D366",
                        color: "var(--bg-card)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <span>💬</span>
                      <span>{t("leads.contactWhatsApp")}</span>
                    </button>
                  )}

                  {!selectedLead.convertedClientId ? (
                    <button
                      type="button"
                      onClick={() => handleConvert(selectedLead)}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "1px solid #10b981",
                        background: "rgba(16, 185, 129, 0.1)",
                        color: "var(--success)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <span>🤝</span>
                      <span>{t("leads.convertToClient")}</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: 8,
                        background: "rgba(16, 185, 129, 0.1)",
                        color: "var(--success)",
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "center",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      {t("leads.alreadyConverted")}
                    </div>
                  )}
                </div>

                {/* Contact & Lead Info Card */}
                <div
                  style={{
                    background: "var(--bg-app)",
                    borderRadius: 12,
                    padding: 14,
                    border: "1px solid var(--border-color)",
                    marginBottom: 20,
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {selectedLead.phone && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>📞 {t("leads.phone")}:</span>{" "}
                      <b>{selectedLead.phone}</b>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>✉️ {t("leads.email")}:</span>{" "}
                      <b>{selectedLead.email}</b>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>💰 {t("leads.estimatedValue")}:</span>{" "}
                    <b>
                      {selectedLead.estimatedValue != null
                        ? `${selectedLead.estimatedValue.toLocaleString("fr-DZ")} ${agencyCurrency}`
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>📅 {t("leads.followUpDate")}:</span>{" "}
                    <b>
                      {selectedLead.followUpDate
                        ? new Date(selectedLead.followUpDate).toLocaleDateString("fr-DZ")
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>👤 {t("leads.assignedTo")}:</span>{" "}
                    <b>{selectedLead.assignedTo?.name || t("leads.chooseAssignee")}</b>
                  </div>
                  {selectedLead.lostReason && (
                    <div style={{ color: "var(--danger)" }}>
                      <span>⚠️ {t("leads.lostReason")}:</span> <b>{selectedLead.lostReason}</b>
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                        📝 {t("leads.notes")}:
                      </span>
                      <div style={{ whiteSpace: "pre-wrap", color: "var(--text-main)" }}>
                        {selectedLead.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes Timeline */}
                <div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text-main)",
                      margin: "0 0 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>💬</span>
                    <span>{t("leads.notesTimeline")}</span>
                  </h3>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} style={{ marginBottom: 16 }}>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder={t("leads.notePlaceholder")}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-color)",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                        resize: "vertical",
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="submit"
                        disabled={noteSubmitting || !newNote.trim()}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: "var(--primary-color)",
                          color: "var(--bg-card)",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: noteSubmitting || !newNote.trim() ? "not-allowed" : "pointer",
                          opacity: noteSubmitting || !newNote.trim() ? 0.6 : 1,
                        }}
                      >
                        {t("leads.addNote")}
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(!selectedLead.notesList || selectedLead.notesList.length === 0) ? (
                      <div
                        style={{
                          padding: "20px 12px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: 12,
                          background: "var(--bg-app)",
                          borderRadius: 8,
                        }}
                      >
                        {t("leads.noNotes")}
                      </div>
                    ) : (
                      selectedLead.notesList.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            background: "var(--bg-app)",
                            borderRadius: 10,
                            padding: "12px 14px",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-main)" }}>
                              👤 {n.author?.name || "Membre"}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {new Date(n.createdAt).toLocaleDateString("fr-DZ")}{" "}
                              {new Date(n.createdAt).toLocaleTimeString("fr-DZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-main)", whiteSpace: "pre-wrap" }}>
                            {n.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxSizing: "border-box",
              direction: lang === "ar" ? "rtl" : "ltr",
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-main)" }}>
                {editingLead ? t("leads.editTitle") : t("leads.createTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  border: "none",
                  background: "var(--bg-hover)",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Name */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.name")}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Company */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.company")}
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.phone")}
                  </label>
                  <input
                    type="text"
                    placeholder="0550... / 06... / 07..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      direction: "ltr",
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.email")}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      direction: "ltr",
                    }}
                  />
                </div>

                {/* Source */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.source")}
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    {SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {t(s.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stage */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.stage")}
                  </label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(s.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estimated Value */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.estimatedValue")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="50000"
                    value={form.estimatedValue}
                    onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Follow-up Date */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.followUpDate")}
                  </label>
                  <input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Assignee */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.assignedTo")}
                  </label>
                  <select
                    value={form.assignedToId}
                    onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">{t("leads.chooseAssignee")}</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lost Reason (conditional) */}
                {form.stage === "LOST" && (
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--danger)" }}>
                      {t("leads.lostReason")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("leads.lostReasonPlaceholder")}
                      value={form.lostReason}
                      onChange={(e) => setForm({ ...form, lostReason: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "1px solid #fca5a5",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}

                {/* Notes */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("leads.notes")}
                  </label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--primary-color)",
                    color: "var(--bg-card)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {t("leads.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
