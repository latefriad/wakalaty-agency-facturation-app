import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const SERVICE_CONFIG = {
  META_ADS: { label: "Meta Ads", icon: "📘", color: "var(--primary-color)", bg: "#eff6ff" },
  WEBSITE: { label: "Site Web", icon: "🌐", color: "#0d9488", bg: "#f0fdfa" },
  TESTILI: { label: "Testili", icon: "🧪", color: "#7c3aed", bg: "#f5f3ff" },
  VOICE_OFF: { label: "Voice Off", icon: "🎙️", color: "var(--warning)", bg: "rgba(245, 158, 11, 0.1)" },
  VIDEO_EDITING: { label: "Montage Vidéo", icon: "🎬", color: "#e11d48", bg: "#fff1f2" },
  CONTENT: { label: "Création Contenu", icon: "✍️", color: "var(--success)", bg: "rgba(16, 185, 129, 0.1)" },
};

const PRIORITY_CONFIG = {
  HIGH: { label: "Haute", color: "var(--danger)", bg: "#fee2e2" },
  MEDIUM: { label: "Moyenne", color: "var(--warning)", bg: "#fef3c7" },
  LOW: { label: "Basse", color: "#16a34a", bg: "#dcfce7" },
};

export default function ProjectTemplates() {
  const { t } = useLang();
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const isAds = profile?.role === "ADS";
  const isDesigner = profile?.role === "DESIGNER";
  const canApply = isAdmin || isAds || isDesigner;

  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Filter
  const [selectedServiceType, setSelectedServiceType] = useState("");

  // Editor Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    serviceType: "META_ADS",
    description: "",
    tasks: [],
  });

  // Apply Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [targetTemplate, setTargetTemplate] = useState(null);
  const [applyClientId, setApplyClientId] = useState("");
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [applying, setApplying] = useState(false);

  // Fetch templates and clients
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedServiceType) params.serviceType = selectedServiceType;

      const [resTpl, resClients] = await Promise.all([
        api.get("/project-templates", params),
        api.get("/clients"),
      ]);

      setTemplates(resTpl.data || []);
      setClients(resClients.data || []);
      if (resClients.data?.length > 0 && !applyClientId) {
        setApplyClientId(resClients.data[0].id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedServiceType, applyClientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seed default templates on demand
  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await api.post("/project-templates/seed");
      toast.success(t("projectTpl.seededSuccess"));
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      serviceType: "META_ADS",
      description: "",
      tasks: [
        {
          title: "Étape 1 : Cadrage & Brief",
          description: "",
          defaultPriority: "HIGH",
          dayOffsetFromStart: 0,
          defaultRole: "ADMIN",
        },
        {
          title: "Étape 2 : Production & Exécution",
          description: "",
          defaultPriority: "MEDIUM",
          dayOffsetFromStart: 3,
          defaultRole: "ADS",
        },
      ],
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      name: tpl.name || "",
      serviceType: tpl.serviceType || "META_ADS",
      description: tpl.description || "",
      tasks: (tpl.tasks || []).map((t) => ({
        title: t.title,
        description: t.description || "",
        defaultPriority: t.defaultPriority || "MEDIUM",
        dayOffsetFromStart: t.dayOffsetFromStart || 0,
        defaultRole: t.defaultRole || "",
      })),
    });
    setIsEditModalOpen(true);
  };

  // Task rows management in editor modal
  const handleAddTaskRow = () => {
    const lastOffset =
      formData.tasks.length > 0
        ? formData.tasks[formData.tasks.length - 1].dayOffsetFromStart + 2
        : 0;
    setFormData({
      ...formData,
      tasks: [
        ...formData.tasks,
        {
          title: "",
          description: "",
          defaultPriority: "MEDIUM",
          dayOffsetFromStart: lastOffset,
          defaultRole: "",
        },
      ],
    });
  };

  const handleRemoveTaskRow = (index) => {
    setFormData({
      ...formData,
      tasks: formData.tasks.filter((_, i) => i !== index),
    });
  };

  const handleUpdateTaskRow = (index, field, value) => {
    const updated = [...formData.tasks];
    updated[index][field] = value;
    setFormData({ ...formData, tasks: updated });
  };

  // Save template (Create or Update)
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Le nom du modèle est requis");
    if (formData.tasks.some((t) => !t.title.trim())) {
      return toast.error("Chaque tâche doit avoir un titre");
    }

    setFormSaving(true);
    try {
      if (editingTemplate) {
        await api.put(`/project-templates/${editingTemplate.id}`, formData);
        toast.success(t("common.saved") || "Modèle enregistré");
      } else {
        await api.post("/project-templates", formData);
        toast.success(t("common.created") || "Modèle créé");
      }
      setIsEditModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm(t("projectTpl.deleteConfirm"))) return;
    try {
      await api.delete(`/project-templates/${id}`);
      toast.success(t("common.deleted") || "Modèle supprimé");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // Open Apply Modal
  const handleOpenApplyModal = (tpl) => {
    setTargetTemplate(tpl);
    setApplyStartDate(new Date().toISOString().slice(0, 10));
    if (clients.length > 0 && !applyClientId) {
      setApplyClientId(clients[0].id);
    }
    setIsApplyModalOpen(true);
  };

  // Submit Apply Template to Client
  const handleConfirmApply = async (e) => {
    e.preventDefault();
    if (!targetTemplate || !applyClientId) return;

    setApplying(true);
    try {
      const res = await api.post(`/project-templates/${targetTemplate.id}/apply`, {
        clientId: applyClientId,
        startDate: applyStartDate,
      });

      const clientName =
        clients.find((c) => c.id === applyClientId)?.name || "client";

      toast.success(
        t("projectTpl.appliedSuccess", {
          count: res.data?.appliedTasksCount || targetTemplate.tasks?.length || 0,
          client: clientName,
        }),
        { duration: 5000 }
      );

      setIsApplyModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setApplying(false);
    }
  };

  // Calculate task preview date
  const computeDueDatePreview = (startDateStr, dayOffset) => {
    const d = startDateStr ? new Date(startDateStr) : new Date();
    d.setDate(d.getDate() + Number(dayOffset || 0));
    return d.toLocaleDateString();
  };

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📐</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              {t("projectTpl.title")}
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
            {t("projectTpl.subtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isAdmin && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDefaults}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontWeight: 600,
                fontSize: 13,
                cursor: seeding ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>⚡</span> {seeding ? "..." : t("projectTpl.seedDefaults")}
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "var(--bg-card)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>+</span> {t("projectTpl.newTemplate")}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs by Service */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedServiceType("")}
          style={{
            padding: "8px 16px",
            borderRadius: 20,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: selectedServiceType === "" ? "#0f172a" : "var(--border-color)",
            color: selectedServiceType === "" ? "#fff" : "var(--text-main)",
            whiteSpace: "nowrap",
          }}
        >
          {t("common.all") || "Tous"} ({templates.length})
        </button>

        {Object.entries(SERVICE_CONFIG).map(([key, cfg]) => {
          const count = templates.filter((t) => t.serviceType === key).length;
          const isActive = selectedServiceType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedServiceType(key)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: isActive ? cfg.color : cfg.bg,
                color: isActive ? "#fff" : cfg.color,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{cfg.icon}</span> {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
          ⏳ {t("common.loading")}...
        </div>
      ) : templates.length === 0 ? (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: 60,
            border: "1px solid var(--border-color)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>📐</div>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-main)", fontWeight: 700 }}>
            {t("projectTpl.noTemplates")}
          </h3>
          {isAdmin && (
            <button
              type="button"
              onClick={handleSeedDefaults}
              style={{
                marginTop: 18,
                padding: "10px 22px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary-color)",
                color: "var(--bg-card)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚡ {t("projectTpl.seedDefaults")}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {templates.map((tpl) => {
            const srv = SERVICE_CONFIG[tpl.serviceType] || SERVICE_CONFIG.META_ADS;
            const tasks = tpl.tasks || [];
            const duration =
              tasks.length > 0
                ? Math.max(...tasks.map((t) => t.dayOffsetFromStart || 0))
                : 0;

            return (
              <div
                key={tpl.id}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 14,
                  padding: 22,
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  {/* Top Bar: Service Badge + Duration */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: srv.bg,
                        color: srv.color,
                        fontWeight: 700,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {srv.icon} {srv.label}
                    </span>

                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      ⏳ {t("projectTpl.durationDays", { days: duration })}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: 17,
                      fontWeight: 700,
                      color: "var(--text-main)",
                      lineHeight: 1.3,
                    }}
                  >
                    {tpl.name}
                  </h3>
                  {tpl.description && (
                    <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {tpl.description}
                    </p>
                  )}

                  {/* Tasks Milestones Preview */}
                  <div
                    style={{
                      background: "var(--bg-app)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-main)",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      📋 {t("projectTpl.tasksCount", { count: tasks.length })}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {tasks.slice(0, 4).map((tsk, i) => (
                        <div
                          key={tsk.id || i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            padding: "3px 0",
                            borderBottom: i < 3 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                            {i + 1}. {tsk.title}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              background: "var(--bg-card)",
                              padding: "1px 6px",
                              borderRadius: 4,
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            J+{tsk.dayOffsetFromStart}
                          </span>
                        </div>
                      ))}
                      {tasks.length > 4 && (
                        <div style={{ fontSize: 11, color: "var(--primary-color)", fontWeight: 600, marginTop: 4 }}>
                          + {tasks.length - 4} autres étapes...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: 14,
                  }}
                >
                  {canApply && (
                    <button
                      type="button"
                      onClick={() => handleOpenApplyModal(tpl)}
                      style={{
                        flex: 1,
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "var(--bg-card)",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      🚀 {t("projectTpl.applyToClient")}
                    </button>
                  )}

                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tpl)}
                        title="Modifier"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-card)",
                          color: "var(--text-main)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        title="Supprimer"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
                          background: "#fee2e2",
                          color: "var(--danger)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════ TEMPLATE EDITOR MODAL (CREATE / EDIT) ═══════════════ */}
      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              direction: "inherit",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingTemplate ? t("projectTpl.editTemplate") : t("projectTpl.newTemplate")}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate}>
              {/* Template Name & Service Type */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Nom du modèle *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lancement Campagne Meta Ads E-commerce"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("projectTpl.serviceType")} *
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 14,
                      boxSizing: "border-box",
                      background: "var(--bg-card)",
                    }}
                  >
                    {Object.entries(SERVICE_CONFIG).map(([k, cfg]) => (
                      <option key={k} value={k}>
                        {cfg.icon} {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Description de la méthodologie
                </label>
                <textarea
                  rows={2}
                  placeholder="Objectif du modèle, livrables attendus..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Task Milestones List */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <label style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                    Étapes et tâches séquentielles ({formData.tasks.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTaskRow}
                    style={{
                      background: "#eff6ff",
                      color: "var(--primary-color)",
                      border: "1px solid #bfdbfe",
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("projectTpl.addTask")}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {formData.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-app)",
                        borderRadius: 8,
                        padding: 12,
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", minWidth: 20 }}>
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Intitulé de la tâche (e.g. Conception maquette)"
                          value={task.title}
                          onChange={(e) => handleUpdateTaskRow(idx, "title", e.target.value)}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            fontSize: 13,
                          }}
                        />

                        {/* Day offset */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, width: 110 }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>J+</span>
                          <input
                            type="number"
                            min="0"
                            title={t("projectTpl.dayOffset")}
                            value={task.dayOffsetFromStart}
                            onChange={(e) => handleUpdateTaskRow(idx, "dayOffsetFromStart", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: 6,
                              border: "1px solid var(--border-color)",
                              fontSize: 13,
                            }}
                          />
                        </div>

                        {/* Priority */}
                        <select
                          value={task.defaultPriority}
                          onChange={(e) => handleUpdateTaskRow(idx, "defaultPriority", e.target.value)}
                          style={{
                            padding: "8px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            fontSize: 12,
                            background: "var(--bg-card)",
                          }}
                        >
                          <option value="HIGH">Haute</option>
                          <option value="MEDIUM">Moyenne</option>
                          <option value="LOW">Basse</option>
                        </select>

                        {/* Role */}
                        <select
                          value={task.defaultRole}
                          onChange={(e) => handleUpdateTaskRow(idx, "defaultRole", e.target.value)}
                          style={{
                            padding: "8px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            fontSize: 12,
                            background: "var(--bg-card)",
                          }}
                        >
                          <option value="">Rôle libre</option>
                          <option value="ADMIN">Admin</option>
                          <option value="ADS">Media Buyer</option>
                          <option value="DESIGNER">Designer</option>
                          <option value="VIDEO">Monteur Vidéo</option>
                          <option value="EDITOR">Copywriter / Rédacteur</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveTaskRow(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--danger)",
                            cursor: "pointer",
                            fontSize: 16,
                            padding: "4px 8px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--primary-color)",
                    color: "var(--bg-card)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: formSaving ? "not-allowed" : "pointer",
                    opacity: formSaving ? 0.7 : 1,
                  }}
                >
                  {formSaving ? "..." : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ APPLY TEMPLATE TO CLIENT MODAL ═══════════════ */}
      {isApplyModalOpen && targetTemplate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsApplyModalOpen(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              direction: "inherit",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  🚀 {t("projectTpl.applyModalTitle", { name: targetTemplate.name })}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  Toutes les tâches seront automatiquement injectées dans le Kanban des tâches du client sélectionné.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmApply}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                {/* Select Client */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Client bénéficiaire *
                  </label>
                  <select
                    required
                    value={applyClientId}
                    onChange={(e) => setApplyClientId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    {t("projectTpl.startDate")} *
                  </label>
                  <input
                    type="date"
                    required
                    value={applyStartDate}
                    onChange={(e) => setApplyStartDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Tasks Preview with Computed Dates */}
              <div
                style={{
                  background: "var(--bg-app)",
                  borderRadius: 10,
                  padding: 14,
                  border: "1px solid var(--border-color)",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
                  Aperçu du calendrier des livrables :
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(targetTemplate.tasks || []).map((t, idx) => {
                    const duePreview = computeDueDatePreview(applyStartDate, t.dayOffsetFromStart);
                    const pCfg = PRIORITY_CONFIG[t.defaultPriority] || PRIORITY_CONFIG.MEDIUM;

                    return (
                      <div
                        key={t.id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                          padding: "6px 8px",
                          background: "var(--bg-card)",
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{idx + 1}. {t.title}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: pCfg.bg,
                              color: pCfg.color,
                            }}
                          >
                            {pCfg.label}
                          </span>
                        </div>
                        <span style={{ color: "var(--primary-color)", fontWeight: 600, fontSize: 11 }}>
                          📅 {duePreview} (J+{t.dayOffsetFromStart})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  style={{
                    padding: "9px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "var(--bg-card)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: applying ? "not-allowed" : "pointer",
                    opacity: applying ? 0.7 : 1,
                  }}
                >
                  {applying ? "..." : "Confirmer et Créer les Tâches"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
