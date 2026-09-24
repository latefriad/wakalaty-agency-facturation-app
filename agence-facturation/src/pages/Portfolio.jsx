import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  addPortfolioItem,
  deletePortfolioItem,
  getPortfolioItems,
  updatePortfolioItem,
} from "../services/portfolioService";

const emptyForm = {
  title: "",
  description: "",
  clientName: "",
  website: "",
  image: "",
  category: "تصميم",
  tags: "",
};

const CATEGORIES = ["تصميم", "تسويق", "ويب", "SEO", "محتوى", "أخرى"];

export default function Portfolio() {
  const { t } = useLang();
  const confirm = useConfirm();
  const { agencyId, isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);

  const canEdit = !!isAdmin;

  const fetchItems = async () => {
    if (!agencyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolioItems(agencyId);
      setItems(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const tagsArray = useMemo(() => {
    const v = (form.tags || "").trim();
    if (!v) return [];
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  }, [form.tags]);

  const handleOpenCreate = () => {
    if (!canEdit) return;
    setSelectedId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (id) => {
    if (!canEdit) return;
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setSelectedId(id);
    setForm({
      title: item.title || "",
      description: item.description || "",
      clientName: item.clientName || "",
      website: item.website || "",
      image: item.image || "",
      category: item.category || "تصميم",
      tags: (item.tags || []).join(", "),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (!form.title.trim()) return toast.error(t("pf.titleRequired"));

    if (!agencyId) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || "",
        clientName: form.clientName || "",
        website: form.website || "",
        image: form.image || "",
        category: form.category || "أخرى",
        tags: tagsArray,
      };

      if (selectedId) {
        await updatePortfolioItem(agencyId, selectedId, payload);
      } else {
        await addPortfolioItem(agencyId, payload);
      }

      setShowModal(false);
      setSelectedId(null);
      setForm(emptyForm);
      await fetchItems();
      toast.success(t(selectedId ? "common.saved" : "common.created"));
    } catch (e) {
      console.error(e);
      toast.error(t("pf.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canEdit) return;
    if (!(await confirm(t("pf.deleteConfirm")))) return;
    try {
      await deletePortfolioItem(id);
      await fetchItems();
      toast.success(t("common.deleted"));
    } catch (err) {
      console.error("Failed to delete portfolio item:", err);
      toast.error(t("pf.deleteError"));
    }
  };

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 60,
          color: "var(--text-muted)",
          direction: "inherit",
          fontFamily: "'Segoe UI', Tahoma, sans-serif",
        }}
      >
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>📁 {t("pf.title")}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
            {items.length} {t("pf.item")}
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
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
            + {t("pf.addItem")}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fee2e2", padding: 14, borderRadius: 12, marginBottom: 16 }}>
          {t("pf.loadError")}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div>{t("pf.empty")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px,1fr))", gap: 16 }}>
          {items.map((item) => {
            const tags = Array.isArray(item.tags) ? item.tags : [];
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 14,
                  padding: 18,
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {item.clientName ? `${t("pf.client")} ${item.clientName}` : "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 20,
                      color: "var(--primary-color)",
                      background: "#dbeafe",
                      width: "fit-content",
                    }}
                  >
                    {item.category || "أخرى"}
                  </div>
                </div>

                {item.image ? (
                  <div
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-app)",
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}

                {item.description ? (
                  <div style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.6 }}>{item.description}</div>
                ) : null}

                {tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {tags.slice(0, 8).map((t, idx) => (
                      <span
                        key={`${t}_${idx}`}
                        style={{
                          fontSize: 12,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: "var(--bg-hover)",
                          color: "var(--text-main)",
                          fontWeight: 600,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {item.website ? (
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      color: "var(--primary-color)",
                      fontWeight: 700,
                      fontSize: 13,
                      marginTop: 2,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    🔗 {t("pf.visitSite")}
                  </a>
                ) : null}

                {canEdit && (
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button
                      onClick={() => handleOpenEdit(item.id)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-app)",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--text-main)",
                        fontWeight: 700,
                      }}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: "1px solid #fee2e2",
                        background: "#fff5f5",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--danger)",
                        fontWeight: 700,
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
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
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 26,
              width: "100%",
              maxWidth: 620,
              direction: "inherit",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border-color)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 18 }}>
              {selectedId ? "✏️ " + t("pf.editItem") : "➕ " + t("pf.addItem")}
            </h2>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.titleLabel")}</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("pf.titlePlaceholder")}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border-color)",
                fontSize: 14,
                marginBottom: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.description")}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t("pf.descPlaceholder")}
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border-color)",
                fontSize: 14,
                marginBottom: 14,
                outline: "none",
                boxSizing: "border-box",
                resize: "none",
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.clientName")}</label>
                <input
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder={t("pf.clientCompany")}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 14, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.category")}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 14, outline: "none" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.siteUrl")}</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://example.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 14, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("pf.imageUrl")}</label>
                <input
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 14, outline: "none" }}
                />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tags (افصل بفواصل)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="مثال: branding, seo, ads"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 14, marginBottom: 18, outline: "none" }}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  background: "var(--primary-color)",
                  color: "var(--bg-card)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? t("common.saving") : selectedId ? t("clients.saveEdits") : t("pf.addBtn")}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSaving(false);
                }}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  background: "var(--bg-hover)",
                  color: "var(--text-main)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

