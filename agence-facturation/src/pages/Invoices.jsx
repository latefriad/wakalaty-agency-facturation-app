import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { useSubscription } from "../hooks/useSubscription";
import UpgradeModal from "../components/UpgradeModal";
import {
  getInvoicesPage,
  addInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "../services/invoicesService";
import { getClients } from "../services/clientsService";
import { getServices } from "../services/servicesService";

import InvoicePDF from "../components/InvoicePDF";
import Pagination from "../components/Pagination";
import { TEMPLATES } from "../components/InvoiceTemplates";

const PAGE_SIZE = 20;

const emptyForm = {
  clientId: "",
  clientName: "",
  services: [{ serviceId: "", name: "", price: "" }],
  tax: 19,
  dueDate: "",
  notes: "",
  template: "classic",
  currency: "DZD",
  exchangeRate: 1,
  depositType: "",
  depositValue: "",
  penaltyRate: "",
};

const CURRENCIES = ["DZD", "EUR", "USD"];

const STATUS = {
  DRAFT: { key: "status.DRAFT", color: "#64748b", bg: "#f1f5f9" },
  SENT: { key: "status.SENT", color: "#0ea5e9", bg: "#e0f2fe" },
  VUE: { key: "status.VUE", color: "#6366f1", bg: "#e0e7ff" },
  EN_ATTENTE: { key: "status.EN_ATTENTE", color: "#f59e0b", bg: "#fef3c7" },
  EN_RETARD: { key: "status.EN_RETARD", color: "#dc2626", bg: "#fee2e2" },
  PAYEE: { key: "status.PAYEE", color: "#10b981", bg: "#d1fae5" },
  ANNULEE: { key: "status.ANNULEE", color: "#ef4444", bg: "#fee2e2" },
  en_attente: { key: "status.EN_ATTENTE", color: "#f59e0b", bg: "#fef3c7" },
  payée: { key: "status.PAYEE", color: "#10b981", bg: "#d1fae5" },
  annulée: { key: "status.ANNULEE", color: "#ef4444", bg: "#fee2e2" },
};

const STATUS_API_MAP = {
  en_attente: "EN_ATTENTE",
  payée: "PAYEE",
  annulée: "ANNULEE",
};

export default function Invoices() {
  const { agencyId, agency } = useAuth();
  const { t } = useLang();
  const confirm = useConfirm();
  const { canAdd, getLimit } = useSubscription();

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [docType, setDocType] = useState("FACTURE");
  const [recurring, setRecurring] = useState([]);

  const fetchRecurring = async () => {
    setLoading(true);
    try {
      const res = await api.get("/recurring-invoices");
      setRecurring(res.data || []);
      setPagination(null);
    } catch (err) {
      console.error("Failed to load recurring:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    if (docType === "RECURRING") return fetchRecurring();
    setLoading(true);
    try {
      const res = await getInvoicesPage({ page, limit: PAGE_SIZE, docType });
      setInvoices(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || null);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    try {
      const [cli, svcs] = await Promise.all([getClients(), getServices()]);
      setClients(Array.isArray(cli) ? cli : []);
      setServices(Array.isArray(svcs) ? svcs : []);
    } catch (err) {
      console.error("Failed to load selectors:", err);
    }
    await fetchInvoices();
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, docType]);

  const calcSubtotal = (svcs) =>
    svcs.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

  const calcTotal = (svcs, tax) => {
    const sub = calcSubtotal(svcs);
    return sub + (sub * (parseFloat(tax) || 0)) / 100;
  };

  const addServiceRow = () =>
    setForm((f) => ({
      ...f,
      services: [...f.services, { serviceId: "", name: "", price: "" }],
    }));

  const removeService = (i) =>
    setForm((f) => ({
      ...f,
      services: f.services.filter((_, idx) => idx !== i),
    }));

  const updateServiceRow = (i, key, val) =>
    setForm((f) => ({
      ...f,
      services: f.services.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)),
    }));

  const handleServiceChange = (i, serviceId) => {
    const svc = services.find((s) => s.id === serviceId);
    setForm((f) => ({
      ...f,
      services: f.services.map((s, idx) =>
        idx === i
          ? {
              ...s,
              serviceId,
              name: svc?.name || "",
              price: svc?.basePrice != null ? String(svc.basePrice) : "",
            }
          : s
      ),
    }));
  };

  const handleClientChange = (id) => {
    const c = clients.find((c) => c.id === id);
    setForm((f) => ({ ...f, clientId: id, clientName: c?.name || "" }));
  };

  const handleSave = async (asDraft = false) => {
    if (!form.clientId) return toast.error(t("inv.chooseClient"));
    if (!form.services[0]?.serviceId && !form.services[0]?.name)
      return toast.error(t("inv.needService"));

    setSaving(true);
    try {
      const items = form.services
        .filter((s) => s.name)
        .map((s) => ({
          description: s.name,
          quantity: 1,
          unitPrice: parseFloat(s.price) || 0,
        }));

      await addInvoice({
        clientId: form.clientId,
        items,
        tax: parseFloat(form.tax) || 0,
        notes: form.notes,
        dueDate: form.dueDate || null,
        docType,
        currency: form.currency || "DZD",
        exchangeRate: parseFloat(form.exchangeRate) || 1,
        ...(form.depositType ? { depositType: form.depositType, depositValue: parseFloat(form.depositValue) || 0 } : {}),
        penaltyRate: parseFloat(form.penaltyRate) || 0,
        ...(asDraft ? { status: "DRAFT" } : {}),
      });

      setShowModal(false);
      setForm(emptyForm);
      fetchInvoices();
      toast.success(t(asDraft ? "inv.draftSaved" : "common.created"));
    } catch (err) {
      console.error("Failed to save invoice:", err);
      toast.error(t("inv.saveError") + ": " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Finalise un brouillon : le backend attribue le numéro légal séquentiel.
  const handleFinalize = async (inv) => {
    if (!(await confirm({ message: t("inv.finalizeConfirm"), danger: false }))) return;
    try {
      const res = await api.post(`/invoices/${inv.id}/finalize`);
      toast.success(t("inv.invoiceCreated", { number: res.data.number }));
      fetchInvoices();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleStatus = async (id, status) => {
    try {
      const apiStatus = STATUS_API_MAP[status] || status.toUpperCase();
      await updateInvoiceStatus(id, apiStatus);
      fetchInvoices();
    } catch (err) {
      console.error("Status error:", err);
      toast.error(t("inv.statusError"));
    }
  };

  const handleAddPayment = async (inv) => {
    const remaining = inv.balance ?? inv.total;
    const raw = window.prompt(t("inv.paymentPrompt", { remaining: remaining.toFixed(2) }), remaining.toFixed(2));
    if (raw === null) return;
    const amount = parseFloat(raw);
    if (!amount || amount <= 0) return toast.error(t("inv.invalidAmount"));
    try {
      await api.post(`/invoices/${inv.id}/payments`, { amount });
      fetchInvoices();
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleConvert = async (inv) => {
    if (!(await confirm({ message: t("inv.convertConfirm", { number: inv.number }), danger: false }))) return;
    try {
      const res = await api.post(`/invoices/${inv.id}/convert`);
      toast.success(t("inv.invoiceCreated", { number: res.data.number }));
      setDocType("FACTURE");
      setPage(1);
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleSendEmail = async (inv) => {
    if (!inv.client?.email) return toast.error(t("inv.noClientEmail"));
    if (!(await confirm({ message: t("inv.sendConfirm", { number: inv.number, email: inv.client.email }), danger: false }))) return;
    try {
      await api.post(`/invoices/${inv.id}/send`);
      toast.success(t("inv.sent"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleCopyLink = (inv) => {
    const url = `${window.location.origin}/f/${inv.publicToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("inv.linkCopied")),
      () => window.prompt(t("inv.copyLink"), url)
    );
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem("wakalati_token");
      const base = process.env.REACT_APP_API_URL || "/api";
      const res = await fetch(`${base}/invoices/export/csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export impossible");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleMakeRecurring = async (inv) => {
    const freq = window.prompt(t("inv.recurringPrompt"), "1");
    if (freq === null) return;
    const frequency = { "1": "MONTHLY", "3": "QUARTERLY", "12": "YEARLY" }[freq.trim()];
    if (!frequency) return toast.error(t("inv.invalidValue"));
    try {
      await api.post("/recurring-invoices", {
        clientId: inv.client?.id || inv.clientId,
        items: (inv.items || []).map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
        })),
        tax: inv.tax,
        discount: inv.discount,
        notes: inv.notes,
        frequency,
      });
      toast.success(t("inv.recurringCreated"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleToggleRecurring = async (rec) => {
    try {
      await api.patch(`/recurring-invoices/${rec.id}`, { active: !rec.active });
      fetchRecurring();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleDeleteRecurring = async (id) => {
    if (!(await confirm(t("inv.recurringDeleteConfirm")))) return;
    try {
      await api.delete(`/recurring-invoices/${id}`);
      fetchRecurring();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm(t("inv.deleteConfirm")))) return;
    try {
      await deleteInvoice(id);
      fetchInvoices();
      toast.success(t("common.deleted"));
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      toast.error(t("inv.deleteError"));
    }
  };

  const filtered = invoices.filter((inv) => {
    if (filter === "all") return true;
    const st = inv.displayStatus || inv.status;
    return st === filter || st === STATUS_API_MAP[filter];
  });

  const totalRevenue = invoices
    .filter((i) => i.status === "PAYEE" || i.status === "payée")
    .reduce((s, i) => s + (i.total || 0), 0);

  const unpaidCount = invoices.filter(
    (i) => i.status === "EN_ATTENTE" || i.status === "en_attente"
  ).length;

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t("inv.title")}</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            {t("inv.summary", { total: pagination?.total ?? invoices.length, unpaid: unpaidCount })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleExportCsv}
          style={{ background: "#fff", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          📥 CSV
        </button>
        <button
          onClick={() => {
            if (!canAdd("invoices", pagination?.total ?? invoices.length)) {
              setShowUpgrade(true);
              return;
            }
            setShowModal(true);
          }}
          style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          {docType === "DEVIS" ? t("inv.newQuote") : t("inv.newInvoice")}
        </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: t("inv.totalRevenue"), value: `${totalRevenue.toFixed(2)} ${t("common.currency")}`, color: "#10b981" },
          { label: t("inv.pendingInvoices"), value: unpaidCount, color: "#f59e0b" },
          { label: t("inv.totalInvoices"), value: pagination?.total ?? invoices.length, color: "#6366f1" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { key: "FACTURE", label: t("inv.invoicesTab") },
          { key: "DEVIS", label: t("inv.quotesTab") },
          { key: "RECURRING", label: t("inv.recurringTab") },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setDocType(tab.key); setPage(1); setFilter("all"); }}
            style={{ padding: "9px 20px", borderRadius: 10, border: docType === tab.key ? "2px solid #3b82f6" : "1px solid #e2e8f0", cursor: "pointer", fontSize: 14, fontWeight: 700, background: docType === tab.key ? "#eff6ff" : "#fff", color: docType === tab.key ? "#1d4ed8" : "#64748b" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "all", label: t("common.all") },
          { key: "DRAFT", label: t("status.DRAFT") },
          { key: "SENT", label: t("status.SENT") },
          { key: "EN_ATTENTE", label: t("status.EN_ATTENTE") },
          { key: "EN_RETARD", label: t("status.EN_RETARD") },
          { key: "PAYEE", label: t("status.PAYEE") },
          { key: "ANNULEE", label: t("status.ANNULEE") },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, background: filter === tab.key ? "#3b82f6" : "#f1f5f9", color: filter === tab.key ? "#fff" : "#64748b" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>{t("common.loading")}</div>}

      {!loading && docType !== "RECURRING" && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <div>{t("inv.empty")}</div>
        </div>
      )}

      {docType === "RECURRING" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recurring.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              {t("inv.recurringEmpty")}
            </div>
          )}
          {recurring.map((rec) => {
            const FREQ = { MONTHLY: t("inv.monthly"), QUARTERLY: t("inv.quarterly"), YEARLY: t("inv.yearly") };
            const total = (rec.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
            return (
              <div key={rec.id} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, opacity: rec.active ? 1 : 0.55 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    🔁 {rec.clientName} <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#eff6ff", color: "#3b82f6", marginRight: 8 }}>{FREQ[rec.frequency]}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {t("inv.nextIssue")}: {new Date(rec.nextRunAt).toLocaleDateString("fr-DZ")} — {t("inv.servicesCount", { count: (rec.items || []).length })}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{total.toFixed(2)} {t("common.currency")}</div>
                  <button onClick={() => handleToggleRecurring(rec)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, color: rec.active ? "#f59e0b" : "#10b981" }}>
                    {rec.active ? t("inv.pause") : t("inv.resume")}
                  </button>
                  <button onClick={() => handleDeleteRecurring(rec.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {docType !== "RECURRING" && filtered.map((inv) => {
          const st = STATUS[inv.displayStatus || inv.status] || STATUS.EN_ATTENTE;
          const stLabel = t(st.key);
          return (
            <div key={inv.id} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{inv.number || t("inv.draftLabel")}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 20, color: st.color, background: st.bg }}>{stLabel}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>📄 {inv.client?.name || t("dash.client")}</div>
                {inv.dueDate && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{t("inv.dueDate")}: {new Date(inv.dueDate).toLocaleDateString("fr-DZ")}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{(inv.total || 0).toFixed(2)} {inv.currency || t("common.currency")}</div>
                  {inv.paidAmount > 0 && inv.balance > 0 && (
                    <div style={{ fontSize: 12, color: "#f59e0b" }}>{t("inv.paid")}: {inv.paidAmount.toFixed(2)} — {t("inv.remaining")}: {inv.balance.toFixed(2)}</div>
                  )}
                  {inv.depositAmount > 0 && (
                    <div style={{ fontSize: 12, color: "#4f46e5" }}>{t("inv.depositLabel")}: {inv.depositAmount.toFixed(2)} {inv.currency || t("common.currency")}</div>
                  )}
                  {inv.penaltyAmount > 0 && (
                    <div style={{ fontSize: 12, color: "#dc2626" }}>⚠️ {t("inv.penaltyLabel")}: +{inv.penaltyAmount.toFixed(2)} {inv.currency || t("common.currency")}</div>
                  )}
                </div>
                {inv.status === "DRAFT" ? (
                  <button onClick={() => handleFinalize(inv)} title={t("inv.finalize")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4f46e5", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✓ {t("inv.finalize")}</button>
                ) : (
                  <>
                    <select
                      value={inv.status}
                      onChange={(e) => handleStatus(inv.id, e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" }}
                    >
                      <option value="EN_ATTENTE">{t("status.EN_ATTENTE")}</option>
                      <option value="SENT">{t("status.SENT")}</option>
                      <option value="PAYEE">{t("status.PAYEE")}</option>
                      <option value="ANNULEE">{t("status.ANNULEE")}</option>
                    </select>
                    {inv.docType === "DEVIS" ? (
                      <button onClick={() => handleConvert(inv)} title={t("inv.toInvoice")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1fae5", background: "#ecfdf5", color: "#059669", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{t("inv.toInvoice")}</button>
                    ) : (
                      inv.status !== "PAYEE" && inv.status !== "ANNULEE" && (
                        <button onClick={() => handleAddPayment(inv)} title={t("inv.recordPayment")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{t("inv.recordPayment")}</button>
                      )
                    )}
                  </>
                )}
                {inv.docType === "FACTURE" && (
                  <button onClick={() => handleMakeRecurring(inv)} title={t("inv.makeRecurring")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13 }}>🔁</button>
                )}
                <button onClick={() => handleSendEmail(inv)} title={t("inv.sendByEmail")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13 }}>✉️</button>
                <button onClick={() => handleCopyLink(inv)} title={t("inv.copyClientLink")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13 }}>🔗</button>
                <button onClick={() => setSelectedInvoice(inv)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #dbeafe", background: "#eff6ff", color: "#3b82f6", cursor: "pointer", fontSize: 13 }}>👁️</button>
                <button onClick={() => handleDelete(inv.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination pagination={pagination} page={page} onChange={setPage} />

      {selectedInvoice && <InvoicePDF invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      {showUpgrade && <UpgradeModal resource="invoices" limit={getLimit("invoices")} onClose={() => setShowUpgrade(false)} />}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, direction: "rtl", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>{docType === "DEVIS" ? t("inv.newQuoteModal") : t("inv.newInvoiceModal")}</h2>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.clientRequired")}</label>
            <select value={form.clientId} onChange={(e) => handleClientChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box" }}>
              <option value="">{t("inv.chooseClientOpt")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("inv.servicesRequired")}</label>
            {form.services.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={s.serviceId} onChange={(e) => handleServiceChange(i, e.target.value)} style={{ flex: 2, padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", background: "#fff" }}>
                  <option value="">{t("inv.chooseService")}</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ))}
                </select>
                <input placeholder={t("inv.pricePlaceholder")} type="number" value={s.price} onChange={(e) => updateServiceRow(i, "price", e.target.value)} style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none" }} />
                {form.services.length > 1 && (
                  <button onClick={() => removeService(i)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, color: "#ef4444", cursor: "pointer", padding: "0 12px", fontSize: 16 }}>×</button>
                )}
              </div>
            ))}

            <button onClick={addServiceRow} style={{ background: "#f1f5f9", border: "1px dashed #cbd5e1", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#64748b", marginBottom: 16, width: "100%" }}>{t("inv.addService")}</button>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("inv.templateLabel")}</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm((f) => ({ ...f, template: t.id }))} style={{ flex: 1, border: form.template === t.id ? "2px solid #3b82f6" : "1px solid #e2e8f0", borderRadius: 10, padding: "10px 8px", cursor: "pointer", background: form.template === t.id ? "#eff6ff" : "#fff", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.taxLabel")}</label>
                <input type="number" min="0" max="100" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: Math.max(0, parseFloat(e.target.value) || 0) }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.dueDate")}</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Devise + taux de change (taux affiché seulement hors DZD) */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.currencyLabel")}</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value, ...(e.target.value === "DZD" ? { exchangeRate: 1 } : {}) }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fff" }}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.currency !== "DZD" && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.exchangeRateLabel", { currency: form.currency })}</label>
                  <input type="number" min="0" step="0.01" value={form.exchangeRate} onChange={(e) => setForm((f) => ({ ...f, exchangeRate: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </div>

            {/* Acompte + pénalité de retard */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1.4 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.depositLabel")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={form.depositType} onChange={(e) => setForm((f) => ({ ...f, depositType: e.target.value }))} style={{ padding: "9px 8px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", background: "#fff" }}>
                    <option value="">{t("inv.depositNone")}</option>
                    <option value="PERCENT">%</option>
                    <option value="FIXED">{form.currency}</option>
                  </select>
                  <input type="number" min="0" disabled={!form.depositType} value={form.depositValue} onChange={(e) => setForm((f) => ({ ...f, depositValue: e.target.value }))} placeholder={form.depositType === "PERCENT" ? "30" : "5000"} style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", background: form.depositType ? "#fff" : "#f8fafc" }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("inv.penaltyLabel")}</label>
                <input type="number" min="0" max="100" value={form.penaltyRate} onChange={(e) => setForm((f) => ({ ...f, penaltyRate: e.target.value }))} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>{t("inv.subtotal")}</span>
                <span>{calcSubtotal(form.services).toFixed(2)} {form.currency}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                <span>{t("inv.grandTotal")}</span>
                <span style={{ color: "#3b82f6" }}>{calcTotal(form.services, form.tax).toFixed(2)} {form.currency}</span>
              </div>
              {form.depositType && parseFloat(form.depositValue) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "#4f46e5" }}>
                  <span>{t("inv.depositLabel")}</span>
                  <span>{(form.depositType === "PERCENT" ? calcTotal(form.services, form.tax) * (parseFloat(form.depositValue) || 0) / 100 : parseFloat(form.depositValue) || 0).toFixed(2)} {form.currency}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleSave(false)} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {saving ? t("common.saving") : t("inv.createBtn")}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} title={t("inv.draftHint")} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                📝 {t("inv.saveDraft")}
              </button>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 14 }}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
