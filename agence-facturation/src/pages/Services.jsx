import { useState, useEffect } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getServices, addService, deleteService } from "../services/servicesService";
import { getEmployees } from "../services/employeesService";

const CHARGE_TYPES = [
  "إيجار",
  "رواتب",
  "إعلانات Google",
  "إعلانات Meta",
  "أدوات ومعدات",
  "أخرى",
];

const SERVICE_TYPES = [
  { label: "إدارة التواصل الاجتماعي", icon: "📁" },
  { label: "تقييم جرافيك وإعلانات", icon: "🎨" },
  { label: "إدارة حملات الإعلانين", icon: "💂" },
  { label: "تسويق وإنتاج محتوى", icon: "🎬" },
  { label: "تدسين محركات البحث SEO", icon: "🔍" },
  { label: "تدقيق وتطوير مواقع", icon: "💻" },
  { label: "استراتيجيات تسويق", icon: "📊" },
  { label: "أخرى", icon: "⚙️" },
];

const emptyForm = {
  name: "",
  type: SERVICE_TYPES[0].label,
  salePrice: "",
  charges: [{ label: "إيجار", amount: "" }],
  notes: "",
  freelancerId: "",
  freelancerName: "",
  commissionType: "percent",
  commissionValue: "",
  commissionAmount: 0,
};

export default function Services() {
  const { t } = useLang();
  const confirm = useConfirm();
  const { agencyId } = useAuth();

  const [services, setServices] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const data = await getServices();
      setServices(data);
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreelancers = async () => {
    try {
      const data = await getEmployees();
      const list = (Array.isArray(data) ? data : []).filter(
        (e) => e.jobType === "freelancer"
      );
      setFreelancers(list);
    } catch (err) {
      console.error("Failed to load freelancers:", err);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchFreelancers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const calcCharges = (charges) =>
    charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const calcProfit = (salePrice, charges) =>
    parseFloat(salePrice || 0) - calcCharges(charges);

  const addCharge = () =>
    setForm((f) => ({
      ...f,
      charges: [...f.charges, { label: "أخرى", amount: "" }],
    }));

  const removeCharge = (i) =>
    setForm((f) => ({
      ...f,
      charges: f.charges.filter((_, idx) => idx !== i),
    }));

  const updateCharge = (i, key, val) =>
    setForm((f) => ({
      ...f,
      charges: f.charges.map((c, idx) =>
        idx === i ? { ...c, [key]: val } : c
      ),
    }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t("svc.nameRequired"));
    if (!form.salePrice) return toast.error(t("svc.salePriceRequired"));
    if (parseFloat(form.salePrice) < 0) return toast.error(t("svc.salePriceNegative"));
    if (form.charges.some((c) => parseFloat(c.amount) < 0)) return toast.error(t("svc.costsNegative"));
    setSaving(true);

    try {
      const totalCharges = calcCharges(form.charges);
      const netProfit = calcProfit(form.salePrice, form.charges);

      let adjustedProfit = netProfit;
      if (form.freelancerId && form.commissionAmount > 0) {
        adjustedProfit = netProfit - form.commissionAmount;
      }

      await addService({
        name: form.name,
        type: form.type,
        salePrice: parseFloat(form.salePrice),
        totalCharges,
        netProfit: adjustedProfit,
        notes: form.notes,
        charges: form.charges,
        freelancerId: form.freelancerId || null,
        freelancerName: form.freelancerName || null,
        commissionType: form.commissionType,
        commissionValue: parseFloat(form.commissionValue) || 0,
        commissionAmount: form.commissionAmount || 0,
      });

      setShowModal(false);
      setForm(emptyForm);
      fetchServices();
      toast.success(t("common.saved"));
    } catch (err) {
      console.error("Failed to save service:", err);
      toast.error(t("svc.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm(t("svc.deleteConfirm")))) return;
    try {
      await deleteService(id);
      fetchServices();
      toast.success(t("common.deleted"));
    } catch (err) {
      console.error("Failed to delete service:", err);
      toast.error(t("svc.deleteError"));
    }
  };

  const totalRevenue = services.reduce((s, sv) => s + (sv.salePrice || 0), 0);
  const totalChargesSum = services.reduce((s, sv) => s + (sv.totalCharges || 0), 0);
  const totalProfit = services.reduce((s, sv) => s + (sv.netProfit || 0), 0);

  const profitColor = (p) => (p >= 0 ? "#10b981" : "#ef4444");

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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>⚙️ {t("svc.title")}</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            {services.length} {t("svc.registered")}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setShowModal(true);
          }}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          + {t("svc.addService")}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          {t("common.loading")}
        </div>
      )}

      {!loading && services.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
          <div>{t("svc.empty")}</div>
        </div>
      )}

      <div className="responsive-grid" style={{ gap: 16 }}>
        {services.map((sv) => {
          const profit = sv.netProfit || 0;
          const margin = sv.salePrice ? Math.round((profit / sv.salePrice) * 100) : 0;
          const icon = SERVICE_TYPES.find((t) => t.label === sv.type)?.icon || "⚙️";

          return (
            <div
              key={sv.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: 20,
                border: "1px solid #e2e8f0",
                borderTop: `3px solid ${profitColor(profit)}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{sv.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{sv.type}</div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    color: profitColor(profit),
                    background: profit >= 0 ? "#d1fae522" : "#fee2e222",
                  }}
                >
                  {margin}% {t("svc.margin")}
                </div>
              </div>

              {sv.freelancerId && sv.commissionAmount > 0 && (
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "6px 10px", borderRadius: 8,
                  background: "#fef3c7", marginBottom: 8,
                  fontSize: 12
                }}>
                  <span style={{ color: "#92400e" }}>
                    💼 {t("svc.commission")} {sv.freelancerName}
                  </span>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>
                    {(sv.commissionAmount || 0).toFixed(2)} {t("common.currency")}
                  </span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>💰 {t("svc.salePrice")}</span>
                  <span style={{ fontWeight: 600, color: "#3b82f6" }}>
                    {(sv.salePrice || 0).toFixed(2)} {t("common.currency")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>💸 {t("svc.costs")}</span>
                  <span style={{ fontWeight: 600, color: "#f59e0b" }}>
                    {(sv.totalCharges || 0).toFixed(2)} {t("common.currency")}
                  </span>
                </div>
                {sv.commissionAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>💼 {t("svc.freelancerCommission")}</span>
                    <span style={{ fontWeight: 600, color: "#f59e0b" }}>
                      {(sv.commissionAmount || 0).toFixed(2)} {t("common.currency")}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px solid #f1f5f9", paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>📊 {t("svc.netProfit")}</span>
                  <span style={{ fontWeight: 700, color: profitColor(profit) }}>{profit.toFixed(2)} {t("common.currency")}</span>
                </div>
              </div>

              <button
                onClick={() => setSelected(selected === sv.id ? null : sv.id)}
                style={{
                  width: "100%",
                  padding: "7px 0",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 8,
                }}
              >
                {selected === sv.id ? "▲ " + t("svc.hideCosts") : "▼ " + t("svc.showCosts")}
              </button>

              {selected === sv.id && (
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  {(sv.charges || []).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        padding: "4px 0",
                        borderBottom: i < (sv.charges || []).length - 1 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>• {c.label}</span>
                      <span style={{ fontWeight: 500 }}>{parseFloat(c.amount || 0).toFixed(2)} {t("common.currency")}</span>
                    </div>
                  ))}
                </div>
              )}

              {sv.notes && <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>📝 {sv.notes}</div>}

              <button
                onClick={() => handleDelete(sv.id)}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: "7px 0",
                  borderRadius: 8,
                  border: "1px solid #fee2e2",
                  background: "#fff5f5",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, direction: "inherit", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>➕ {t("svc.newService")}</h2>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("svc.nameLabel")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("svc.namePlaceholder")}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
            />

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("svc.type")}</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 14, outline: "none", boxSizing: "border-box" }}>
              {SERVICE_TYPES.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💰 {t("svc.salePriceLabel")}</label>
            <input
              type="number"
              value={form.salePrice}
              onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
              placeholder="0.00"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
            />

            {/* Freelancer Assignment */}
            {freelancers.length > 0 && (
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 12, padding: 16, marginBottom: 16
              }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#92400e" }}>
                  💼 {t("svc.assignFreelancer")}
                </label>

                <select
                  value={form.freelancerId}
                  onChange={(e) => {
                    const fl = freelancers.find((f) => f.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      freelancerId: e.target.value,
                      freelancerName: fl?.name || "",
                      commissionValue: fl?.commissionRate || "",
                    }));
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">{t("svc.noFreelancer")}</option>
                  {freelancers.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.name} ({fl.commissionRate || 0}% {t("svc.commission")})
                    </option>
                  ))}
                </select>

                {form.freelancerId && (
                  <>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#92400e" }}>
                      {t("svc.commissionType")}
                    </label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {[
                        { val: "percent", label: t("svc.percent") },
                        { val: "fixed", label: t("svc.fixed") },
                      ].map((t) => (
                        <button key={t.val} type="button"
                          onClick={() => setForm((f) => ({
                            ...f, commissionType: t.val,
                            commissionValue: ""
                          }))}
                          style={{
                            flex: 1, padding: "8px 0",
                            borderRadius: 8, border: "none",
                            cursor: "pointer", fontSize: 12,
                            fontWeight: 600,
                            background: form.commissionType === t.val ? "#f59e0b" : "#fff",
                            color: form.commissionType === t.val ? "#fff" : "#92400e",
                            fontFamily: "'Segoe UI',Tahoma,sans-serif"
                          }}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#92400e" }}>
                      {form.commissionType === "percent" ? t("svc.commissionRatePct") : t("svc.commissionAmount")}
                    </label>
                    <input
                      type="number"
                      value={form.commissionValue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const sale = parseFloat(form.salePrice) || 0;
                        const amount = form.commissionType === "percent"
                          ? (sale * val / 100)
                          : val;
                        setForm((f) => ({
                          ...f,
                          commissionValue: e.target.value,
                          commissionAmount: amount,
                        }));
                      }}
                      placeholder={form.commissionType === "percent" ? t("emp.example20") : t("svc.example5000")}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" }}
                    />

                    {form.commissionValue && (
                      <div style={{
                        background: "#fff",
                        borderRadius: 8, padding: "10px 14px",
                        display: "flex", justifyContent: "space-between",
                        fontSize: 13, fontWeight: 600
                      }}>
                        <span style={{ color: "#92400e" }}>
                          💼 {t("svc.commission")} {form.freelancerName}:
                        </span>
                        <span style={{ color: "#f59e0b" }}>
                          {form.commissionAmount.toFixed(2)} {t("common.currency")}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💸 {t("svc.costsAndExpenses")}</label>
            {form.charges.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={c.label} onChange={(e) => updateCharge(i, "label", e.target.value)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" }}>
                  {CHARGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input type="number" value={c.amount} placeholder={t("svc.amountPlaceholder")} onChange={(e) => updateCharge(i, "amount", e.target.value)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" }} />
                {form.charges.length > 1 && (
                  <button onClick={() => removeCharge(i)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, color: "#ef4444", cursor: "pointer", padding: "0 12px", fontSize: 16 }}>×</button>
                )}
              </div>
            ))}

            <button onClick={addCharge} style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px dashed #cbd5e1", background: "#f8fafc", cursor: "pointer", fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              + {t("svc.addCost")}
            </button>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("common.notes")}</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("svc.notesPlaceholder")} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box", resize: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {saving ? t("common.saving") : t("svc.addBtn")}
              </button>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 14 }}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
