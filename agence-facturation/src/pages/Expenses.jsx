import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import { api, apiUpload, apiDownload } from "../services/api";

// Saisie des charges de l'agence — la source du bénéfice réel du dashboard.
// Catégories fermées, alignées sur expenses.schema.js côté serveur.
const CATEGORIES = [
  { value: "SALAIRES", icon: "👥" },
  { value: "LOYER", icon: "🏢" },
  { value: "ADS", icon: "📢" },
  { value: "ABONNEMENTS", icon: "🔁" },
  { value: "MATERIEL", icon: "🖥️" },
  { value: "IMPOTS", icon: "🏛️" },
  { value: "TRANSPORT", icon: "🚗" },
  { value: "AUTRE", icon: "📌" },
];

const CURRENCIES = ["DZD", "EUR", "USD"];

const emptyForm = {
  amount: "",
  currency: "DZD",
  exchangeRate: "1",
  category: "AUTRE",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Expenses() {
  const { t } = useLang();
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  // Budget mensuel : objectif d'encaissements + plafonds par catégorie.
  const [showBudget, setShowBudget] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [budgetForm, setBudgetForm] = useState({ revenueTarget: "", perCat: {} });
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get("/expenses", { limit: 100, category: filterCat || undefined });
      setExpenses(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total ?? 0);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [filterCat]);

  // Charge le budget du mois sélectionné (s'il existe) dans le formulaire.
  const loadBudget = async (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    try {
      const res = await api.get("/budgets", { year });
      const existing = (res.data || []).find((b) => b.month === month);
      setBudgetForm({
        revenueTarget: existing ? String(existing.revenueTarget) : "",
        perCat: Object.fromEntries(
          Object.entries(existing?.expenseBudgets || {}).map(([k, v]) => [k, String(v)])
        ),
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openBudget = async () => {
    setShowBudget(true);
    await loadBudget(budgetMonth);
  };

  const saveBudget = async () => {
    const [year, month] = budgetMonth.split("-").map(Number);
    setSavingBudget(true);
    try {
      const expenseBudgets = Object.fromEntries(
        Object.entries(budgetForm.perCat)
          .map(([k, v]) => [k, parseFloat(v)])
          .filter(([, v]) => Number.isFinite(v) && v > 0)
      );
      await api.put(`/budgets/${year}/${month}`, {
        revenueTarget: parseFloat(budgetForm.revenueTarget) || 0,
        expenseBudgets: Object.keys(expenseBudgets).length ? expenseBudgets : null,
      });
      toast.success(t("budget.saved"));
      setShowBudget(false);
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setSavingBudget(false);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return toast.error(t("exp.amountRequired"));
    setSaving(true);
    try {
      const payload = {
        amount,
        currency: form.currency,
        exchangeRate: parseFloat(form.exchangeRate) || 1,
        category: form.category,
        date: form.date || undefined,
        notes: form.notes || null,
      };
      if (editExp) {
        await api.put(`/expenses/${editExp.id}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      toast.success(t(editExp ? "common.saved" : "common.created"));
      setShowModal(false);
      setEditExp(null);
      setForm(emptyForm);
      fetchExpenses();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (exp) => {
    if (!(await confirm(t("exp.deleteConfirm")))) return;
    try {
      await api.delete(`/expenses/${exp.id}`);
      toast.success(t("common.deleted"));
      fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAttach = async (exp, file) => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiUpload(`/expenses/${exp.id}/attachment`, fd);
      toast.success(t("exp.attachmentAdded"));
      fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (exp) => {
    setEditExp(exp);
    setForm({
      amount: String(exp.amount),
      currency: exp.currency || "DZD",
      exchangeRate: String(exp.exchangeRate || 1),
      category: exp.category,
      date: exp.date ? exp.date.slice(0, 10) : "",
      notes: exp.notes || "",
    });
    setShowModal(true);
  };

  const catMeta = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];
  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 {t("exp.title")}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>{total} {t("exp.registered")}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openBudget} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🎯 {t("budget.button")}
          </button>
          <button onClick={() => { setForm(emptyForm); setEditExp(null); setShowModal(true); }} className="btn-primary">
            + {t("exp.add")}
          </button>
        </div>
      </div>

      {/* Filtre par catégorie */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => setFilterCat("")}
          style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid", borderColor: !filterCat ? "#3b82f6" : "var(--border-color)", background: !filterCat ? "#dbeafe" : "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {t("common.all")}
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid", borderColor: filterCat === c.value ? "#3b82f6" : "var(--border-color)", background: filterCat === c.value ? "#dbeafe" : "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {c.icon} {t(`exp.cat.${c.value}`)}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>{t("common.loading")}</div>}

      {!loading && expenses.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💸</div>
          <div>{t("exp.empty")}</div>
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {expenses.map((exp) => (
            <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border-color)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {catMeta(exp.category).icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {t(`exp.cat.${exp.category}`)}
                    {exp.notes && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — {exp.notes}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(exp.date).toLocaleDateString()}
                    {exp.attachmentName && (
                      <button onClick={() => apiDownload(`/expenses/${exp.id}/attachment`, exp.attachmentName).catch((e) => toast.error(e.message))}
                        style={{ border: "none", background: "none", color: "var(--primary-color)", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0, marginInlineStart: 8 }}>
                        📎 {exp.attachmentName}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: 15 }}>
                    −{fmt(exp.amount)} {exp.currency}
                  </div>
                  {exp.currency !== "DZD" && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>≈ {fmt(exp.amount * exp.exchangeRate)} {t("common.currency")}</div>
                  )}
                </div>
                <label style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 12 }} title={t("exp.attach")}>
                  📎
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                    onChange={(e) => { handleAttach(exp, e.target.files[0]); e.target.value = ""; }} />
                </label>
                <button onClick={() => openEdit(exp)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => handleDelete(exp)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget mensuel : objectif + plafonds par catégorie */}
      {showBudget && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>🎯 {t("budget.title")}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>{t("budget.hint")}</p>

            <label className="form-label">{t("budget.month")}</label>
            <input type="month" value={budgetMonth}
              onChange={(e) => { setBudgetMonth(e.target.value); loadBudget(e.target.value); }}
              className="form-input" style={{ marginBottom: 14 }} />

            <label className="form-label">💰 {t("budget.revenueTarget")}</label>
            <input type="number" min="0" value={budgetForm.revenueTarget}
              onChange={(e) => setBudgetForm((f) => ({ ...f, revenueTarget: e.target.value }))}
              placeholder="0.00" className="form-input" style={{ marginBottom: 16 }} />

            <label className="form-label">{t("budget.expenseCaps")}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map((c) => (
                <div key={c.value}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{c.icon} {t(`exp.cat.${c.value}`)}</div>
                  <input type="number" min="0" value={budgetForm.perCat[c.value] || ""}
                    onChange={(e) => setBudgetForm((f) => ({ ...f, perCat: { ...f.perCat, [c.value]: e.target.value } }))}
                    placeholder="—" className="form-input" style={{ padding: "7px 10px", fontSize: 13 }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveBudget} disabled={savingBudget} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {savingBudget ? t("common.saving") : t("common.save")}
              </button>
              <button onClick={() => setShowBudget(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "var(--bg-hover)", border: "none", cursor: "pointer", fontSize: 14 }}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>{editExp ? "✏️ " + t("exp.edit") : "➕ " + t("exp.add")}</h2>

            <label className="form-label">{t("exp.category")}</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="form-input" style={{ marginBottom: 14 }}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {t(`exp.cat.${c.value}`)}</option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label">{t("exp.amount")}</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="form-input" style={{ marginBottom: 14 }} />
              </div>
              <div>
                <label className="form-label">{t("exp.currency")}</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value, exchangeRate: e.target.value === "DZD" ? "1" : f.exchangeRate }))} className="form-input" style={{ marginBottom: 14 }}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {form.currency !== "DZD" && (
              <>
                <label className="form-label">{t("exp.exchangeRate")}</label>
                <input type="number" min="0" step="0.0001" value={form.exchangeRate} onChange={(e) => setForm((f) => ({ ...f, exchangeRate: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
              </>
            )}

            <label className="form-label">{t("common.date")}</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />

            <label className="form-label">{t("common.notes")}</label>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("exp.notesPlaceholder")} className="form-input" style={{ marginBottom: 20 }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
              <button onClick={() => { setShowModal(false); setEditExp(null); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "var(--bg-hover)", border: "none", cursor: "pointer", fontSize: 14 }}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
