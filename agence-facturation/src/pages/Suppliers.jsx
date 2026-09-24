import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import { api } from "../services/api";

// Comptes fournisseurs : l'échéancier des factures à payer (engagements) et
// le carnet de fournisseurs. Payer une facture crée la dépense correspondante
// côté serveur — la trésorerie ne bouge qu'à ce moment-là.
const CATEGORIES = ["SALAIRES", "LOYER", "ADS", "ABONNEMENTS", "MATERIEL", "IMPOTS", "TRANSPORT", "AUTRE"];
const CURRENCIES = ["DZD", "EUR", "USD"];

const emptySupplier = { name: "", email: "", phone: "", notes: "" };
const emptyBill = { supplierId: "", reference: "", amount: "", currency: "DZD", exchangeRate: "1", category: "AUTRE", dueDate: "", notes: "" };

export default function Suppliers() {
  const { t } = useLang();
  const confirm = useConfirm();
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState("A_PAYER");
  const [loading, setLoading] = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billForm, setBillForm] = useState(emptyBill);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [supRes, billRes] = await Promise.all([
        api.get("/suppliers"),
        api.get("/suppliers/bills", statusFilter ? { status: statusFilter } : undefined),
      ]);
      setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
      setBills(Array.isArray(billRes.data) ? billRes.data : []);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [statusFilter]);

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return toast.error(t("sup.nameRequired"));
    setSaving(true);
    try {
      if (editSupplier) {
        await api.put(`/suppliers/${editSupplier.id}`, supplierForm);
      } else {
        await api.post("/suppliers", supplierForm);
      }
      toast.success(t(editSupplier ? "common.saved" : "common.created"));
      setShowSupplierModal(false);
      setEditSupplier(null);
      setSupplierForm(emptySupplier);
      fetchAll();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setSaving(false);
  };

  const deleteSupplier = async (sup) => {
    if (!(await confirm(t("sup.deleteConfirm")))) return;
    try {
      await api.delete(`/suppliers/${sup.id}`);
      toast.success(t("common.deleted"));
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveBill = async () => {
    const amount = parseFloat(billForm.amount);
    if (!billForm.supplierId) return toast.error(t("sup.supplierRequired"));
    if (!amount || amount <= 0) return toast.error(t("exp.amountRequired"));
    setSaving(true);
    try {
      await api.post(`/suppliers/${billForm.supplierId}/bills`, {
        reference: billForm.reference || null,
        amount,
        currency: billForm.currency,
        exchangeRate: parseFloat(billForm.exchangeRate) || 1,
        category: billForm.category,
        dueDate: billForm.dueDate || null,
        notes: billForm.notes || null,
      });
      toast.success(t("sup.billCreated"));
      setShowBillModal(false);
      setBillForm(emptyBill);
      fetchAll();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setSaving(false);
  };

  // Le serveur crée la dépense correspondante dans la même transaction.
  const payBill = async (bill) => {
    if (!(await confirm(t("sup.payConfirm")))) return;
    try {
      await api.post(`/suppliers/bills/${bill.id}/pay`);
      toast.success(t("sup.paid"));
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelBill = async (bill) => {
    if (!(await confirm(t("sup.cancelConfirm")))) return;
    try {
      await api.patch(`/suppliers/bills/${bill.id}/cancel`, {});
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
  const isOverdue = (b) => b.status === "A_PAYER" && b.dueDate && new Date(b.dueDate) < new Date();
  const totalPayable = suppliers.reduce((s, x) => s + (x.outstanding || 0), 0);

  const BILL_STATUS = {
    A_PAYER: { color: "var(--warning)", bg: "#fef3c7", key: "sup.toPay" },
    PAYEE: { color: "var(--success)", bg: "#d1fae5", key: "sup.paidStatus" },
    ANNULEE: { color: "var(--text-muted)", bg: "var(--bg-hover)", key: "sup.cancelled" },
  };

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">🚚 {t("sup.title")}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
            {t("sup.totalPayable")} : <strong style={{ color: "var(--danger)" }}>{fmt(totalPayable)} {t("common.currency")}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setSupplierForm(emptySupplier); setEditSupplier(null); setShowSupplierModal(true); }}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            + {t("sup.addSupplier")}
          </button>
          <button onClick={() => { setBillForm(emptyBill); setShowBillModal(true); }} className="btn-primary" disabled={suppliers.length === 0}>
            + {t("sup.addBill")}
          </button>
        </div>
      </div>

      {/* Échéancier */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📅 {t("sup.schedule")}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: "A_PAYER", label: t("sup.toPay") },
              { v: "PAYEE", label: t("sup.paidStatus") },
              { v: "", label: t("common.all") },
            ].map((f) => (
              <button key={f.v} onClick={() => setStatusFilter(f.v)}
                style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid", borderColor: statusFilter === f.v ? "#3b82f6" : "var(--border-color)", background: statusFilter === f.v ? "#dbeafe" : "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{t("common.loading")}</div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{t("sup.noBills")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bills.map((b) => {
              const st = BILL_STATUS[b.status] || BILL_STATUS.A_PAYER;
              return (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: isOverdue(b) ? "#fef2f2" : "var(--bg-app)", border: `1px solid ${isOverdue(b) ? "#fecaca" : "var(--bg-hover)"}`, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {b.supplier?.name}
                      {b.reference && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {b.reference}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: isOverdue(b) ? "#dc2626" : "var(--text-muted)" }}>
                      {b.dueDate ? `📅 ${new Date(b.dueDate).toLocaleDateString()}` : t("sup.noDueDate")}
                      {isOverdue(b) && ` ⚠️ ${t("sup.overdue")}`}
                      {" · "}{t(`exp.cat.${b.category}`)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: "end" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(b.amount)} {b.currency}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: st.color, background: st.bg }}>
                        {t(st.key)}
                      </span>
                    </div>
                    {b.status === "A_PAYER" && (
                      <>
                        <button onClick={() => payBill(b)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--success)", color: "var(--bg-card)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          💸 {t("sup.pay")}
                        </button>
                        <button onClick={() => cancelBill(b)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fournisseurs */}
      <div className="cards-grid">
        {suppliers.map((s) => (
          <div key={s.id} className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🚚 {s.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              {s.phone || s.email || "—"}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: s.outstanding > 0 ? "#fef3c7" : "#f0fdf4", marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{t("sup.outstanding")}</span>
              <strong style={{ color: s.outstanding > 0 ? "#92400e" : "#15803d" }}>
                {fmt(s.outstanding)} {t("common.currency")} ({s.pendingBills})
              </strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditSupplier(s); setSupplierForm({ name: s.name, email: s.email || "", phone: s.phone || "", notes: s.notes || "" }); setShowSupplierModal(true); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 13 }}>
                {t("common.edit")}
              </button>
              <button onClick={() => { setBillForm({ ...emptyBill, supplierId: s.id }); setShowBillModal(true); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "var(--primary-hover)", cursor: "pointer", fontSize: 13 }}>
                + {t("sup.bill")}
              </button>
              <button onClick={() => deleteSupplier(s)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", cursor: "pointer", fontSize: 13 }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modale fournisseur */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>{editSupplier ? "✏️ " + t("sup.editSupplier") : "➕ " + t("sup.addSupplier")}</h2>
            <label className="form-label">{t("clients.fullNameLabel")}</label>
            <input value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
            <label className="form-label">{t("auth.emailLabel")}</label>
            <input value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
            <label className="form-label">{t("common.phone")}</label>
            <input value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
            <label className="form-label">{t("common.notes")}</label>
            <input value={supplierForm.notes} onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))} className="form-input" style={{ marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveSupplier} disabled={saving} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
              <button onClick={() => { setShowSupplierModal(false); setEditSupplier(null); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "var(--bg-hover)", border: "none", cursor: "pointer", fontSize: 14 }}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale facture fournisseur */}
      {showBillModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>➕ {t("sup.addBill")}</h2>

            <label className="form-label">{t("sup.supplier")}</label>
            <select value={billForm.supplierId} onChange={(e) => setBillForm((f) => ({ ...f, supplierId: e.target.value }))} className="form-input" style={{ marginBottom: 14 }}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label className="form-label">{t("sup.reference")}</label>
            <input value={billForm.reference} onChange={(e) => setBillForm((f) => ({ ...f, reference: e.target.value }))} placeholder="FA-2026-001" className="form-input" style={{ marginBottom: 14 }} />

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label">{t("exp.amount")}</label>
                <input type="number" min="0" step="0.01" value={billForm.amount} onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="form-input" style={{ marginBottom: 14 }} />
              </div>
              <div>
                <label className="form-label">{t("exp.currency")}</label>
                <select value={billForm.currency} onChange={(e) => setBillForm((f) => ({ ...f, currency: e.target.value, exchangeRate: e.target.value === "DZD" ? "1" : f.exchangeRate }))} className="form-input" style={{ marginBottom: 14 }}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {billForm.currency !== "DZD" && (
              <>
                <label className="form-label">{t("exp.exchangeRate")}</label>
                <input type="number" min="0" step="0.0001" value={billForm.exchangeRate} onChange={(e) => setBillForm((f) => ({ ...f, exchangeRate: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label">{t("exp.category")}</label>
                <select value={billForm.category} onChange={(e) => setBillForm((f) => ({ ...f, category: e.target.value }))} className="form-input" style={{ marginBottom: 14 }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`exp.cat.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">{t("sup.dueDate")}</label>
                <input type="date" value={billForm.dueDate} onChange={(e) => setBillForm((f) => ({ ...f, dueDate: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
              </div>
            </div>

            <label className="form-label">{t("common.notes")}</label>
            <input value={billForm.notes} onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))} className="form-input" style={{ marginBottom: 20 }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveBill} disabled={saving} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
              <button onClick={() => setShowBillModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "var(--bg-hover)", border: "none", cursor: "pointer", fontSize: 14 }}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
