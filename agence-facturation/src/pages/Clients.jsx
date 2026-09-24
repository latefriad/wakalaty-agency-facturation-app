import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { getClientsPage, addClient, updateClient, deleteClient, getClientTags, checkDuplicateClient } from "../services/clientsService";

import { useSubscription } from "../hooks/useSubscription";
import UpgradeModal from "../components/UpgradeModal";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 24;


const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  tags: [],
  customFields: {},
};

export default function Clients() {
  const { agencyId } = useAuth();
  const { t } = useLang();
  const confirm = useConfirm();

  const { canAdd, getLimit } = useSubscription();


  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [tagFilter, setTagFilter] = useState("");
  // Champs perso édités sous forme de lignes {key,value} puis sérialisés en objet.
  const [cfRows, setCfRows] = useState([]);

  const addTag = (raw) => {
    const tag = (raw || "").trim();
    if (!tag) return;
    setForm((f) => (f.tags.some((x) => x.toLowerCase() === tag.toLowerCase()) ? f : { ...f, tags: [...f.tags, tag] }));
    setTagInput("");
  };
  const removeTag = (tag) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== tag) }));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const res = await getClientsPage({ page, limit: PAGE_SIZE, search: debouncedSearch, ...(tagFilter ? { tag: tagFilter } : {}) });
      setClients(res.data || []);
      setPagination(res.pagination || null);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, page, debouncedSearch, tagFilter]);

  // Liste des tags de l'agence pour le filtre (rechargée après chaque sauvegarde).
  const loadTags = async () => {
    try { setAllTags(await getClientTags()); } catch { /* non bloquant */ }
  };
  useEffect(() => { if (agencyId) loadTags(); /* eslint-disable-next-line */ }, [agencyId]);

  const totalClients = pagination?.total ?? clients.length;

  const openAdd = () => {
    if (!canAdd("clients", totalClients)) {
      setShowUpgrade(true);
      return;
    }

    setEditClient(null);
    setForm(emptyForm);
    setTagInput("");
    setCfRows([]);
    setShowModal(true);
  };


  const openEdit = (client) => {
    setEditClient(client);
    setForm({
      name: client.name || "",
      company: client.company || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      tags: client.tags || [],
      customFields: client.customFields || {},
    });
    setTagInput("");
    setCfRows(Object.entries(client.customFields || {}).map(([key, value]) => ({ key, value: value == null ? "" : String(value) })));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t("clients.nameRequired"));
    // Sérialise les champs perso (clés non vides uniquement).
    const customFields = {};
    for (const { key, value } of cfRows) {
      const k = key.trim();
      if (k) customFields[k] = value;
    }
    const payload = { ...form, customFields };

    // Détection de doublons NON bloquante : on avertit, l'agence tranche.
    try {
      const dups = await checkDuplicateClient({
        email: form.email, name: form.name, company: form.company,
        excludeId: editClient?.id,
      });
      if (dups.length > 0) {
        const list = dups.slice(0, 3).map((d) => `• ${d.name}${d.email ? ` (${d.email})` : ""}`).join("\n");
        const ok = await confirm({
          title: t("clients.dupTitle"),
          message: t("clients.dupMessage", { count: dups.length }) + "\n\n" + list,
          danger: false,
          confirmText: t("clients.dupConfirm"),
        });
        if (!ok) return;
      }
    } catch { /* la vérif ne doit jamais bloquer la création */ }

    setSaving(true);
    try {
      if (editClient) {
        await updateClient(editClient.id, payload);
      } else {
        await addClient(payload);
      }
      setShowModal(false);
      fetchClients();
      loadTags();
      toast.success(t(editClient ? "common.saved" : "common.created"));
    } catch (err) {
      console.error("Failed to save client:", err);
      toast.error(t("clients.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm(t("clients.deleteConfirm")))) return;
    try {
      await deleteClient(id);
      fetchClients();
      toast.success(t("common.deleted"));
    } catch (err) {
      console.error("Failed to delete client:", err);
      toast.error(t("clients.deleteError"));
    }
  };

  // La recherche est déléguée au serveur (param search) : filtrer localement
  // ne verrait que la page courante.
  const filtered = clients;

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length] || colors[0];
  const getInitials = (name) =>
    name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t("clients.title")}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
            {t("clients.registered", { count: totalClients })}
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            background: "var(--primary-color)",
            color: "var(--bg-card)",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("clients.addClient")}
        </button>
      </div>

      <input
        placeholder={t("clients.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          border: "1px solid var(--border-color)",
          fontSize: 14,
          marginBottom: 12,
          outline: "none",
          boxSizing: "border-box",
          background: "var(--bg-card)",
        }}
      />

      {/* Filtre par tag / segment */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={() => { setTagFilter(""); setPage(1); }} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tagFilter === "" ? "#3b82f6" : "var(--bg-hover)", color: tagFilter === "" ? "#fff" : "var(--text-muted)" }}>
            {t("common.all")}
          </button>
          {allTags.map((tag) => (
            <button key={tag} onClick={() => { setTagFilter(tag); setPage(1); }} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tagFilter === tag ? "#4f46e5" : "#eef2ff", color: tagFilter === tag ? "#fff" : "#4f46e5" }}>
              🏷️ {tag}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>{t("common.loading")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div>{search ? t("common.noResults") : t("clients.empty")}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((client) => (
          <div
            key={client.id}
            style={{
              background: "var(--bg-card)",
              borderRadius: 12,
              padding: 20,
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: getColor(client.name),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--bg-card)",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {getInitials(client.name)}
              </div>
              <div onClick={() => navigate(`/clients/${client.id}`)} style={{ cursor: "pointer" }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{client.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{client.company || "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {client.email && <div style={{ fontSize: 13, color: "var(--text-main)" }}>📧 {client.email}</div>}
              {client.phone && <div style={{ fontSize: 13, color: "var(--text-main)" }}>📞 {client.phone}</div>}
              {client.address && <div style={{ fontSize: 13, color: "var(--text-main)" }}>📍 {client.address}</div>}
            </div>
            {client.tags && client.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {client.tags.map((tag) => (
                  <span key={tag} style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            )}
            {client.encours && client.encours.invoiced > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-app)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{t("cd.due")}</span>
                <span style={{ fontWeight: 700, color: client.encours.overdue > 0 ? "#dc2626" : "var(--text-main)" }}>
                  {(client.encours.due || 0).toLocaleString("fr-DZ")} {t("common.currency")}
                  {client.encours.overdue > 0 && <span style={{ fontSize: 11, marginInlineStart: 6, color: "var(--danger)" }}>⚠️</span>}
                </span>
              </div>
            )}
            <button
              onClick={() => navigate(`/clients/${client.id}`)}
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #dbeafe", background: "#eff6ff", color: "var(--primary-color)", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}
            >
              👤 {t("cd.viewSheet")}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => openEdit(client)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-app)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {t("common.edit")}
              </button>
              <button
                onClick={() => handleDelete(client.id)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "1px solid #fee2e2",
                  background: "#fff5f5",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination pagination={pagination} page={page} onChange={setPage} />

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 460,
              direction: "inherit",
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>
              {editClient ? t("clients.editClient") : t("clients.newClient")}
            </h2>

            {[
              { key: "name", label: t("clients.fullNameLabel"), placeholder: t("clients.namePlaceholder") },
              { key: "company", label: t("clients.companyLabel"), placeholder: t("clients.companyPlaceholder") },
              { key: "email", label: t("common.email"), placeholder: "client@email.com" },
              { key: "phone", label: t("common.phone"), placeholder: "+213 555 123 456" },
              { key: "address", label: t("common.address"), placeholder: t("clients.addressPlaceholder") },
            ].map((field) => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {field.label}
                </label>
                <input
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
            {/* Tags / segments */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("clients.tagsLabel")}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {form.tags.map((tag) => (
                  <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#eef2ff", color: "#4f46e5", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                    {tag}
                    <span onClick={() => removeTag(tag)} style={{ cursor: "pointer", fontWeight: 700 }}>×</span>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => addTag(tagInput)}
                placeholder={t("clients.tagsPlaceholder")}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Champs personnalisés */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("clients.customFieldsLabel")}</label>
              {cfRows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    value={row.key}
                    onChange={(e) => setCfRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r)))}
                    placeholder={t("clients.cfKey")}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                  <input
                    value={row.value}
                    onChange={(e) => setCfRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                    placeholder={t("clients.cfValue")}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                  <button type="button" onClick={() => setCfRows((rows) => rows.filter((_, idx) => idx !== i))} style={{ border: "none", background: "#fee2e2", color: "var(--danger)", borderRadius: 8, cursor: "pointer", padding: "0 10px", fontSize: 16 }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setCfRows((rows) => [...rows, { key: "", value: "" }])} style={{ background: "var(--bg-hover)", border: "1px dashed var(--border-color)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", width: "100%" }}>
                + {t("clients.addCustomField")}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 8,
                  background: "var(--primary-color)",
                  color: "var(--bg-card)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {saving ? t("common.saving") : editClient ? t("clients.saveEdits") : t("clients.addBtn")}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 8,
                  background: "var(--bg-hover)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          resource="clients"
          limit={getLimit("clients")}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}


