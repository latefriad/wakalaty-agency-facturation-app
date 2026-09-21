import { useState, useEffect, useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getClients } from "../services/clientsService";
import { generateContractAIContent } from "../services/contractsService";
import toast from "react-hot-toast";
import { Plus, Trash2, FileText, Download, Eye, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";

const CONTRACT_TYPES = [
  { value: "MARKETING", labelAr: "عقد خدمات تسويق رقمي", labelFr: "Contrat Marketing Digital", icon: "📱" },
  { value: "ADS", labelAr: "عقد إدارة حملات إعلانية", labelFr: "Contrat Campagnes Pub", icon: "📢" },
  { value: "MEDIA_BUYER", labelAr: "عقد Media Buying – إدارة الإعلانات", labelFr: "Contrat Media Buying", icon: "🎯" },
  { value: "WEBSITE", labelAr: "عقد تصميم وتطوير موقع", labelFr: "Contrat Création Site Web", icon: "💻" },
  { value: "CAHIER", labelAr: "كراسة الشروط", labelFr: "Cahier des Charges", icon: "📋" },
];

const STATUS_OPTIONS = [
  { value: "active", key: "ct.active", color: "#16a34a", bg: "#dcfce7" },
  { value: "expired", key: "ct.expired", color: "#dc2626", bg: "#fee2e2" },
  { value: "cancelled", key: "ct.cancelled", color: "#9333ea", bg: "#f3e8ff" },
];

const emptyForm = {
  type: "MARKETING",
  clientId: "",
  title: "",
  startDate: "",
  endDate: "",
  value: "",
  notes: "",
  serviceIds: [],
};

export default function Contracts() {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const typeLabel = (ty) => (lang === "ar" ? ty.labelAr : ty.labelFr);
  const { agencyId, agency, isAdmin } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiConfirm, setShowAiConfirm] = useState(false);
  const [aiError, setAiError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const printRef = useRef();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);

      const [contractsRes, clientsList] = await Promise.all([
        api.get(`/contracts?${params.toString()}`),
        getClients(),
      ]);
      setContracts(contractsRes.data?.data || []);
      setClients(clientsList || []);
    } catch (err) {
      console.error(err);
      toast.error(t("ct.loadError"));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchAll();
    }, 400);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterType, filterStatus]);

  const handleClientChange = (id) => {
    const c = clients.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      clientId: id,
      title: f.title || `${t("ct.defaultTitle")} - ${c?.name || ""}`,
    }));
  };

  const handleSave = async () => {
    if (!form.clientId) return toast.error(t("ct.chooseClient"));
    if (!form.title) return toast.error(t("ct.titleRequired"));
    if (!form.startDate) return toast.error(t("ct.startDateRequired"));

    setSaving(true);
    try {
      await api.post("/contracts", {
        title: form.title,
        type: form.type,
        clientId: form.clientId,
        startDate: form.startDate,
        endDate: form.endDate || null,
        value: form.value ? parseFloat(form.value) : 0,
        notes: form.notes || null,
        serviceIds: form.serviceIds.length ? form.serviceIds : undefined,
      });
      toast.success(t("ct.created"));
      setShowModal(false);
      setForm(emptyForm);
      fetchAll();
    } catch (err) {
      console.error(err);
      toast.error(err.message || t("ct.createError"));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!(await confirm(t("ct.deleteConfirm")))) return;
    try {
      await api.delete(`/contracts/${id}`);
      toast.success(t("ct.deleted"));
      fetchAll();
    } catch (err) {
      console.error(err);
      toast.error(err.message || t("ct.deleteError"));
    }
  };

  const handleAiGenerate = async () => {
    if (!form.clientId) return toast.error(t("ct.chooseClientFirst"));
    if (!form.startDate) return toast.error(t("ct.startDateRequired"));
    if (!form.value) return toast.error(t("ct.amountRequired"));

    setShowAiConfirm(false);
    setAiGenerating(true);
    setAiError("");

    try {
      const result = await generateContractAIContent({
        type: form.type,
        clientName: clients.find((c) => c.id === form.clientId)?.name || "",
        services: [],
        totalAmount: form.value,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm((f) => ({
        ...f,
        notes: f.notes
          ? f.notes + "\n\n--- بنود منشأة بالذكاء الاصطناعي ---\n\n" + result.generatedNotes
          : result.generatedNotes,
      }));
      toast.success(t("ct.aiDone"));
    } catch (err) {
      setAiError(err.message || t("ct.aiError"));
      toast.error(err.message || t("ct.aiError"));
    }
    setAiGenerating(false);
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content || !selected) return;

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>عقد ${selected?.title}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;direction:rtl}
        .parties{display:flex;gap:20px;margin-bottom:24px}
        .party{flex:1;padding:14px;border:1px solid #e2e8f0;border-radius:8px}
        .section-title{font-size:15px;font-weight:bold;border-bottom:1px solid #e2e8f0;
          padding-bottom:6px;margin-bottom:12px;color:#1e40af}
        .amount-box{background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;
          padding:16px;text-align:center;margin:16px 0}
        .signatures{display:flex;gap:40px;margin-top:60px}
        .sig-box{flex:1;text-align:center}
        .stamp{width:100px;height:100px;border:2px dashed #94a3b8;border-radius:50%;
          margin:12px auto;display:flex;align-items:center;justify-content:center;
          color:#94a3b8;font-size:11px}
        @media print{body{padding:20px}}
      </style>
    </head><body>${content}</body></html>`);

    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const getStatusBadge = (contract) => {
    const status = contract.status || "active";
    const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          background: opt.bg,
          color: opt.color,
        }}
      >
        {t(opt.key)}
      </span>
    );
  };

  const getClientName = (contract) => {
    return contract.client?.name || contract.clientName || "—";
  };

  const getTypeInfo = (contract) => {
    return CONTRACT_TYPES.find((x) => x.value === contract.type) || CONTRACT_TYPES[0];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "yyyy-MM-dd");
    } catch {
      return dateStr;
    }
  };

  if (!isAdmin && agencyId) {
    return (
      <div style={{ padding: 40, direction: "inherit", textAlign: "center", color: "#94a3b8" }}>
        {t("ct.noAccess")}
      </div>
    );
  }

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileText size={24} style={{ verticalAlign: "middle", marginLeft: 8 }} />
            {t("ct.title")}
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            {contracts.length} {t("ct.registered")}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus size={16} style={{ verticalAlign: "middle", marginLeft: 4 }} />
          {t("ct.create")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e2e8f0",
            flex: "1 1 220px",
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder={t("ct.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          {searchTerm && (
            <X
              size={14}
              color="#94a3b8"
              style={{ cursor: "pointer" }}
              onClick={() => setSearchTerm("")}
            />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={14} color="#94a3b8" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontSize: 12,
              fontFamily: "inherit",
              color: "#475569",
            }}
          >
            <option value="">{t("ct.allTypes")}</option>
            {CONTRACT_TYPES.map((ty) => (
              <option key={ty.value} value={ty.value}>
                {ty.icon} {typeLabel(ty)}
              </option>
            ))}
          </select>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: 12,
            fontFamily: "inherit",
            color: "#475569",
          }}
        >
          <option value="">{t("ct.allStatuses")}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.key)}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>{t("common.loading")}</div>
      )}

      {!loading && contracts.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <FileText size={48} style={{ marginBottom: 12 }} />
          <div>{t("ct.empty")}</div>
        </div>
      )}

      <div className="cards-grid">
        {contracts.map((c) => {
          const ti = getTypeInfo(c);
          return (
            <div key={c.id} className="card" style={{ borderTop: "3px solid #3b82f6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{ti.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title || t("ct.untitled")}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{typeLabel(ti)}</div>
                  </div>
                </div>
                {getStatusBadge(c)}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                👤 {getClientName(c)}
              </div>
              <div style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600, marginBottom: 6 }}>
                💰 {parseFloat(c.value || 0).toLocaleString()} دج
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
                📅 {formatDate(c.startDate)} → {formatDate(c.endDate) || t("ct.open")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setSelected(c);
                    setShowPreview(true);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "1px solid #dbeafe",
                    background: "#eff6ff",
                    color: "#3b82f6",
                    cursor: "pointer",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <Eye size={14} /> {t("ct.preview")}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="btn-danger"
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={18} /> {t("ct.createNew")}
              </h2>
              <button
                onClick={() => { setShowModal(false); setShowAiConfirm(false); setAiError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={20} />
              </button>
            </div>

            <label className="form-label">{t("ct.type")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {CONTRACT_TYPES.map((ty) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    background: form.type === t.value ? "#3b82f6" : "#f1f5f9",
                    color: form.type === t.value ? "#fff" : "#64748b",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <label className="form-label">{t("ct.titleLabel")}</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("ct.titlePlaceholder")}
              className="form-input"
              style={{ marginBottom: 14 }}
            />

            <label className="form-label">{t("inv.clientRequired")}</label>
            <select value={form.clientId} onChange={(e) => handleClientChange(e.target.value)} className="form-input" style={{ marginBottom: 14 }}>
              <option value="">{t("inv.chooseClientOpt")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label className="form-label">{t("ct.startDate")}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">{t("ct.endDate")}</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>

            <label className="form-label">{t("ct.totalAmount")}</label>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="0.00"
              className="form-input"
              style={{ marginBottom: 14 }}
            />

            <label className="form-label">{t("common.notes")}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="form-input"
              style={{ resize: "none", marginBottom: 20 }}
              placeholder={t("ct.notesPlaceholder")}
            />

            {aiError && (
              <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                ❌ {aiError}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAiConfirm(true)}
              disabled={aiGenerating}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: "1px dashed #a78bfa",
                background: aiGenerating ? "#f5f3ff" : "#faf5ff",
                color: aiGenerating ? "#94a3b8" : "#7c3aed",
                cursor: aiGenerating ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {aiGenerating ? t("ct.aiGenerating") : t("ct.aiGenerate")}
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {saving ? t("common.saving") : t("ct.createBtn")}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setShowAiConfirm(false);
                  setAiError("");
                }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 14 }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiConfirm && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 440, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>{t("ct.aiConfirmTitle")}</h3>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              {t("ct.aiConfirmBody")}
              <br />
              {t("ct.aiConfirmNote")}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleAiGenerate}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 8,
                  background: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {t("ct.aiConfirmBtn")}
              </button>
              <button
                onClick={() => setShowAiConfirm(false)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 8,
                  background: "#f1f5f9",
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

      {showPreview && selected && (
        <div className="modal-overlay">
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 780,
              maxHeight: "92vh",
              overflowY: "auto",
              direction: "inherit",
              padding: "0 0 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 10,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={16} /> {selected.title}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handlePrint} className="btn-primary" style={{ padding: "8px 18px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Download size={14} /> {t("ct.printPdf")}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div ref={printRef} style={{ padding: "40px 48px" }}>
              <ContractTemplate contract={selected} agency={agency} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractTemplate({ contract, agency }) {
  if (contract.type === "MEDIA_BUYER") {
    return <MediaBuyerTemplate contract={contract} agency={agency} />;
  }

  const typeMap = {
    MARKETING: { ar: "عقد خدمات التسويق الرقمي", fr: "CONTRAT DE SERVICES MARKETING DIGITAL" },
    ADS: { ar: "عقد إدارة الحملات الإعلانية", fr: "CONTRAT DE GESTION DES CAMPAGNES" },
    WEBSITE: { ar: "عقد تصميم وتطوير الموقع", fr: "CONTRAT DE CRÉATION DE SITE WEB" },
    CAHIER: { ar: "كراسة الشروط والمواصفات", fr: "CAHIER DES CHARGES" },
  };

  const t = typeMap[contract.type] || typeMap.MARKETING;
  const today = new Date().toLocaleDateString("ar-DZ");

  const clientName = contract.client?.name || contract.clientName || "—";

  return (
    <div style={{ fontFamily: "Arial,sans-serif", color: "#1e293b", direction: "inherit" }}>
      <div
        style={{
          textAlign: "center",
          borderBottom: "3px double #1e293b",
          paddingBottom: 20,
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 4 }}>{t.ar}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{t.fr}</div>
        <div style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>
          {contract.title || "عقد بدون عنوان"}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>تاريخ الإنشاء: {today}</div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div
          className="section-title"
          style={{
            fontSize: 14,
            fontWeight: "bold",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: 6,
            marginBottom: 14,
            color: "#1e40af",
          }}
        >
          المادة 1 — أطراف العقد / Article 1 — Parties
        </div>
        <div className="parties" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              padding: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              borderRight: "4px solid #3b82f6",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 10, color: "#1e40af" }}>الطرف الأول / Prestataire</div>
            {[
              ["الاسم", agency?.name],
              ["العنوان", agency?.address],
              ["الهاتف", agency?.phone],
              ["البريد", agency?.email],
              ["الرقم الجبائي", agency?.taxId],
            ]
              .filter(([, v]) => v)
              .map(([l, v]) => (
                <div key={l} style={{ fontSize: 12, marginBottom: 4, color: "#475569" }}>
                  <strong>{l}:</strong> {v}
                </div>
              ))}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              padding: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              borderRight: "4px solid #10b981",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 10, color: "#065f46" }}>الطرف الثاني / Client</div>
            {[
              ["الاسم", clientName],
              ["البريد", contract.client?.email || contract.clientEmail],
            ]
              .filter(([, v]) => v)
              .map(([l, v]) => (
                <div key={l} style={{ fontSize: 12, marginBottom: 4, color: "#475569" }}>
                  <strong>{l}:</strong> {v}
                </div>
              ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 14, color: "#1e40af" }}>
          المادة 2 — مدة العقد / Article 2 — Durée
        </div>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          يبدأ هذا العقد بتاريخ <strong>{contract.startDate ? formatDateStr(contract.startDate) : "—"}</strong>
          {contract.endDate ? (
            <>
              {" "}وينتهي بتاريخ <strong>{formatDateStr(contract.endDate)}</strong>.
            </>
          ) : (
            <> {" "}لمدة غير محددة.</>
          )}
          <br />
          <span style={{ color: "#64748b", fontSize: 11 }}>
            Ce contrat prend effet le {contract.startDate ? formatDateStr(contract.startDate) : "—"}
            {contract.endDate ? ` et se termine le ${formatDateStr(contract.endDate)}` : "."}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 14, color: "#1e40af" }}>
          المادة 3 — المبالغ والدفع / Article 3 — Rémunération
        </div>
        <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1d4ed8" }}>{parseFloat(contract.value || 0).toLocaleString()} دج</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>المبلغ الإجمالي / Montant Total TTC</div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 14, color: "#1e40af" }}>
          المادة 4 — الشروط العامة / Article 4 — Conditions Générales
        </div>
        {[
          { ar: "يلتزم الطرف الأول بتقديم الخدمات في المواعيد المحددة وبالجودة المتفق عليها وبذل عناية الرجل المعتاد.", fr: "Le prestataire s'engage à fournir les services dans les délais et avec la qualité convenus, en faisant preuve de diligence raisonnable." },
          { ar: "يلتزم الطرف الثاني بتزويد الطرف الأول بالمعطيات والوثائق المطلوبة في الوقت المناسب، وإلا يتم تمديد المدة وفقاً لذلك.", fr: "Le client s'engage à fournir au prestataire les informations et documents requis en temps utile ; à défaut, les délais seront ajustés." },
          { ar: "يمتنع الطرفان عن إفشاء أو استغلال أي معلومات سرية يتم تبادلها بموجب هذا العقد، ويظل هذا الالتزام قائماً حتى بعد انتهاء العقد.", fr: "Les deux parties s'interdisent de divulguer ou d'exploiter les informations confidentielles échangées au titre du présent contrat ; cet engagement demeure après sa fin." },
          { ar: "كل تعديل أو ملحق لهذا العقد يجب أن يكون مكتوباً وموقعاً من الطرفين.", fr: "Toute modification ou avenant au présent contrat doit être écrit et signé par les deux parties." },
          { ar: "في حالة التأخر في التنفيذ أو عدم المطابقة، يتم إخطار الطرف الآخر كتابياً، ويباشران تسوية الوضع بما يضمن استمرار الخدمة وفقاً للشروط المتفق عليها.", fr: "En cas de retard ou de non-conformité, la partie concernée informe l'autre par écrit ; elles conviennent d'une résolution garantissant la continuité du service." },
          { ar: "تحدد مسؤولية الطرف الأول ضمن حدود الالتزامات التعاقدية، مع استبعاد أي ضرر غير مباشر ما لم ينص على خلاف ذلك.", fr: "La responsabilité du prestataire est limitée aux obligations contractuelles ; tout dommage indirect est exclu sauf stipulation contraire." },
          { ar: "يتم تسوية الخلافات عن طريق التفاوض أولاً، وفي حالة تعذر ذلك يتم اللجوء إلى الجهة القضائية المختصة بمدينة مكان التنفيذ.", fr: "Les litiges sont réglés d'abord par voie de négociation ; à défaut, recours aux juridictions compétentes du lieu d'exécution." },
          { ar: "القوة القاهرة: لا يُسأل الطرف المتضرر عن أي تأخير أو إخلال بسبب حدث خارج عن إرادته وفقاً للقوانين المعمول بها، بشرط الإخطار.", fr: "Force majeure : aucune partie n'est responsable en cas de retard ou manquement dû à un événement indépendant de sa volonté, sous réserve de notification." },
        ].map((c, i) => (
          <div key={i} style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.7, paddingRight: 12, borderRight: "2px solid #e2e8f0" }}>
            <span style={{ fontWeight: "bold" }}>{i + 1}. </span>
            {c.ar}
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{c.fr}</div>
          </div>
        ))}
      </div>

      {contract.notes ? (
        <div style={{ marginBottom: 22, padding: 14, background: "#fef9c3", borderRadius: 10, fontSize: 12 }}>
          <strong>ملاحظات / Notes:</strong> {contract.notes}
        </div>
      ) : null}

      <div style={{ marginTop: 50 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 30, color: "#1e40af" }}>
          التوقيعات / Signatures
        </div>
        <div className="signatures" style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          {[
            { title: "الطرف الأول / Prestataire", name: agency?.name },
            { title: "الطرف الثاني / Client", name: clientName },
          ].map((sig) => (
            <div key={sig.title} style={{ flex: 1, minWidth: 180, textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 6 }}>{sig.title}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{sig.name}</div>
              <div
                className="stamp"
                style={{
                  width: 90,
                  height: 90,
                  border: "2px dashed #94a3b8",
                  borderRadius: "50%",
                  margin: "10px auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  fontSize: 10,
                }}
              >
                الختم / Cachet
              </div>
              <div style={{ borderTop: "2px solid #1e293b", paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>التوقيع / Signature</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>التاريخ: _______________</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 40, textAlign: "center", fontSize: 10, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
        {agency?.name} — {agency?.address} — {agency?.phone}
        <br />محرر من نسختين أصليتين / Établi en deux exemplaires originaux
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MEDIA BUYER CONTRACT TEMPLATE — عقد تقديم خدمات إدارة الإعلانات
// ═══════════════════════════════════════════════════════════════
function MediaBuyerTemplate({ contract, agency }) {
  const clientName = contract.client?.name || contract.clientName || "________________________";
  const clientEmail = contract.client?.email || contract.clientEmail || "";
  const adBudget = parseFloat(contract.value || 0);
  const agencyFee = Math.round(adBudget * 0.30);
  const totalClient = adBudget + agencyFee;
  const today = new Date().toLocaleDateString("ar-DZ");

  const S = {
    page: { fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1e293b", direction: "rtl", lineHeight: 1.8 },
    header: { textAlign: "center", borderBottom: "4px double #1e293b", paddingBottom: 24, marginBottom: 32 },
    logoArea: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
    agencyName: { fontSize: 22, fontWeight: "bold", color: "#1e40af" },
    contractTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
    contractSub: { fontSize: 12, color: "#64748b", marginBottom: 8 },
    dateRow: { fontSize: 12, color: "#475569" },
    sectionTitle: { fontSize: 14, fontWeight: "bold", borderBottom: "2px solid #3b82f6", paddingBottom: 6, marginBottom: 14, color: "#1e40af", marginTop: 24 },
    parties: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 },
    partyBox: (color) => ({ flex: 1, minWidth: 220, padding: 14, border: `1px solid #e2e8f0`, borderRadius: 10, borderRight: `4px solid ${color}` }),
    partyLabel: (color) => ({ fontWeight: "bold", fontSize: 13, marginBottom: 10, color }),
    field: { fontSize: 12, marginBottom: 5, color: "#475569" },
    blankLine: { display: "inline-block", borderBottom: "1px solid #475569", minWidth: 180, marginRight: 4 },
    listItem: { fontSize: 12.5, marginBottom: 6, paddingRight: 16, position: "relative" },
    bullet: { position: "absolute", right: 0, color: "#3b82f6", fontWeight: "bold" },
    amountBox: { background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 14 },
    amountNum: { fontSize: 28, fontWeight: "bold", color: "#1d4ed8" },
    amountSub: { fontSize: 11, color: "#64748b", marginTop: 4 },
    calcTable: { width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 13 },
    calcTd: { padding: "8px 12px", border: "1px solid #e2e8f0" },
    calcTdBold: { padding: "8px 12px", border: "1px solid #e2e8f0", fontWeight: "bold", background: "#f8fafc" },
    checkRow: { display: "flex", gap: 24, flexWrap: "wrap", margin: "10px 0", fontSize: 13 },
    checkOpt: { display: "flex", alignItems: "center", gap: 8 },
    checkbox: { width: 16, height: 16, border: "1.5px solid #64748b", borderRadius: 3, display: "inline-block" },
    note: { background: "#fef9c3", borderRight: "4px solid #f59e0b", padding: "12px 16px", borderRadius: 8, fontSize: 12, marginBottom: 14 },
    sigBox: { flex: 1, minWidth: 200, textAlign: "center", padding: "0 20px" },
    sigLine: { borderTop: "2px solid #1e293b", paddingTop: 8, marginTop: 60 },
    stamp: { width: 90, height: 90, border: "2px dashed #94a3b8", borderRadius: "50%", margin: "12px auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10 },
    footer: { marginTop: 40, textAlign: "center", fontSize: 10, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 16 },
  };

  const Article = ({ num, title }) => (
    <div style={S.sectionTitle}>المادة {num} – {title}</div>
  );

  const Li = ({ children }) => (
    <div style={S.listItem}>
      <span style={S.bullet}>◆</span> {children}
    </div>
  );

  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.agencyName}>{agency?.name || "Adpowers Digital"}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
          {agency?.address} {agency?.phone ? `| ${agency.phone}` : ""} {agency?.email ? `| ${agency.email}` : ""}
        </div>
        <div style={S.contractTitle}>عقد تقديم خدمات إدارة الإعلانات الرقمية</div>
        <div style={S.contractSub}>MEDIA BUYING AGREEMENT</div>
        {contract.title && <div style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600, marginBottom: 6 }}>{contract.title}</div>}
        <div style={S.dateRow}>تم إبرام هذا العقد بتاريخ: <strong>{today}</strong></div>
      </div>

      {/* ── PARTIES ── */}
      <Article num="التمهيد" title="أطراف العقد" />
      <div style={S.parties}>
        <div style={S.partyBox("#3b82f6")}>
          <div style={S.partyLabel("#1e40af")}>الطرف الأول – الوكالة / Prestataire</div>
          {[
            ["الاسم", agency?.name || "Adpowers Digital"],
            ["العنوان", agency?.address],
            ["الهاتف", agency?.phone],
            ["البريد الإلكتروني", agency?.email],
            ["الرقم الجبائي", agency?.taxId],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} style={S.field}><strong>{l}:</strong> {v}</div>
          ))}
          <div style={S.field}><strong>ويُشار إليها بـ:</strong> "الوكالة"</div>
        </div>
        <div style={S.partyBox("#10b981")}>
          <div style={S.partyLabel("#065f46")}>الطرف الثاني – العميل / Client</div>
          <div style={S.field}><strong>الاسم / الشركة:</strong> {clientName}</div>
          <div style={S.field}><strong>الممثل القانوني:</strong> <span style={S.blankLine} /></div>
          <div style={S.field}><strong>العنوان:</strong> <span style={S.blankLine} /></div>
          <div style={S.field}><strong>الهاتف:</strong> <span style={S.blankLine} /></div>
          {clientEmail && <div style={S.field}><strong>البريد:</strong> {clientEmail}</div>}
          <div style={S.field}><strong>ويُشار إليه بـ:</strong> "العميل"</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 8, textAlign: "center" }}>
        ويُشار إلى الطرفين مجتمعين بـ <strong>"الطرفين"</strong>
      </div>

      {/* ── ART 1 ── */}
      <Article num="1" title="موضوع العقد" />
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        يهدف هذا العقد إلى تحديد شروط وأحكام تقديم خدمات <strong>Media Buying وإدارة الحملات الإعلانية الرقمية</strong> من طرف {agency?.name || "Adpowers Digital"} لصالح العميل.
      </div>
      <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 4 }}>تشمل الخدمات:</div>
      {["إعداد وإدارة الحملات الإعلانية", "إعداد هيكلة الحملات الإعلانية", "تحديد واستهداف الجماهير المناسبة", "إعداد واختبار الحملات والإعلانات", "مراقبة أداء الحملات", "تحليل النتائج والبيانات", "تحسين الحملات والميزانيات", "اختبار الإعلانات والجماهير", "إعادة توزيع الميزانية حسب الأداء", "تقديم تقارير وملخصات حول النتائج"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 2 ── */}
      <Article num="2" title="المنصات الإعلانية" />
      {["Meta Ads – Facebook / Instagram", "TikTok Ads", "Google Ads", "وغيرها من المنصات التي يتم الاتفاق عليها بين الطرفين"].map((s, i) => <Li key={i}>{s}</Li>)}
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>تحدد المنصات المستخدمة حسب استراتيجية المشروع واحتياجات العميل.</div>

      {/* ── ART 3 ── */}
      <Article num="3" title="أتعاب Media Buyer" />
      <div style={S.amountBox}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#1e40af", marginBottom: 8 }}>30% من إجمالي الإنفاق الإعلاني الفعلي</div>
        {adBudget > 0 && (
          <table style={S.calcTable}>
            <tbody>
              <tr><td style={S.calcTdBold}>الإنفاق الإعلاني الفعلي</td><td style={S.calcTd}>{adBudget.toLocaleString("ar-DZ")} دج</td></tr>
              <tr><td style={S.calcTdBold}>أتعاب {agency?.name || "Adpowers Digital"} (30%)</td><td style={S.calcTd}>{agencyFee.toLocaleString("ar-DZ")} دج</td></tr>
              <tr><td style={{ ...S.calcTdBold, background: "#dbeafe" }}>إجمالي ما يدفعه العميل</td><td style={{ ...S.calcTd, fontWeight: "bold", fontSize: 15, color: "#1d4ed8" }}>{totalClient.toLocaleString("ar-DZ")} دج</td></tr>
            </tbody>
          </table>
        )}
        <div style={S.amountSub}>تبقى ميزانية الإعلانات منفصلة عن أتعاب الوكالة</div>
      </div>

      {/* ── ART 4 ── */}
      <Article num="4" title="ميزانية الإعلانات" />
      <div style={{ fontSize: 12.5, marginBottom: 8 }}>ميزانية الإعلانات <strong>لا تدخل ضمن أتعاب الوكالة</strong>. يتحمل العميل بشكل مستقل تكاليف الإعلانات المدفوعة للمنصة. لا تتحمل الوكالة مسؤولية توقف الحملات الناتج عن:</div>
      {["عدم توفر الرصيد", "تأخر العميل في الدفع", "مشاكل بطاقة الدفع", "مشاكل الحساب الإعلاني", "القيود أو الحظر الصادر عن المنصة الإعلانية"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 5 ── */}
      <Article num="5" title="طريقة احتساب الأتعاب" />
      <div style={{ fontSize: 12.5 }}>يتم احتساب أتعاب Media Buying بناءً على <strong>إجمالي الإنفاق الإعلاني الفعلي</strong> خلال فترة التعاون. يحق للوكالة الاطلاع على بيانات الإنفاق من أجل احتساب أتعابها بشكل دقيق. في حال كان العميل هو من يقوم بالدفع مباشرة للمنصة، يلتزم بتوفير البيانات اللازمة.</div>

      {/* ── ART 6 ── */}
      <Article num="6" title="موعد دفع الأتعاب" />
      <div style={{ fontSize: 12.5, marginBottom: 8 }}>يتم دفع أتعاب الوكالة:</div>
      <div style={S.checkRow}>
        {["أسبوعيًا", "شهريًا", "بعد انتهاء كل حملة", "حسب اتفاق خاص"].map((opt) => (
          <div key={opt} style={S.checkOpt}><span style={S.checkbox} /> {opt}</div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>الخيار المعتمد: <span style={{ ...S.blankLine, minWidth: 300 }} /></div>
      <div style={S.note}>⚠️ في حالة التأخر في دفع الأتعاب، يحق للوكالة تعليق خدمات إدارة الحملات إلى غاية تسوية المبلغ المستحق.</div>

      {/* ── ART 7 ── */}
      <Article num="7" title="التزامات الوكالة" />
      {["إدارة الحملات الإعلانية وفق استراتيجية مناسبة للمشروع", "مراقبة أداء الحملات بشكل دوري", "تحليل البيانات والمؤشرات الرئيسية", "إجراء الاختبارات والتحسينات اللازمة", "محاولة تحسين استخدام الميزانية الإعلانية بناءً على البيانات", "تقديم التقارير أو الملخصات المتفق عليها", "الحفاظ على سرية المعلومات المتعلقة بالعميل ومشروعه"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 8 ── */}
      <Article num="8" title="التزامات العميل" />
      {["توفير المعلومات والمواد اللازمة لإنشاء الحملات", "توفير الصور والفيديوهات والنصوص والعروض والأسعار عند الحاجة", "توفير الوصول إلى الحسابات الإعلانية والصفحات المطلوبة", "توفير ميزانية الإعلانات في الوقت المناسب", "ضمان قانونية المنتجات والخدمات التي يتم الإعلان عنها", "الرد على طلبات الوكالة والموافقات في الوقت المناسب", "عدم تغيير إعدادات الحملات دون التنسيق مع الوكالة", "دفع أتعاب الوكالة في المواعيد المتفق عليها"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 9 ── */}
      <Article num="9" title="المحتوى والمواد الإعلانية" />
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>يتحمل العميل مسؤولية توفير: الصور، الفيديوهات، عروض المنتجات، الأسعار، المعلومات التجارية، بيانات التواصل.</div>
      <div style={S.note}>🔔 الخدمات الإضافية كالتصميمات، الفيديوهات، Voice-over، Landing Page، Website — <strong>لا تدخل تلقائياً ضمن خدمة Media Buying</strong> وتُسعَّر بشكل منفصل.</div>

      {/* ── ART 10 ── */}
      <Article num="10" title="التعديلات والخدمات الإضافية" />
      <div style={{ fontSize: 12.5 }}>أي طلب لإضافة خدمات غير منصوص عليها قد يؤدي إلى تعديل السعر والمدة. لا يتم تنفيذ الخدمات الإضافية إلا بعد الاتفاق عليها واعتماد السعر من الطرفين.</div>

      {/* ── ART 11 ── */}
      <Article num="11" title="النتائج والإعلانات" />
      <div style={S.note}>⚠️ تلتزم الوكالة ببذل جهود مهنية في إدارة الحملات، ولكنها <strong>لا تضمن عددًا معينًا من المبيعات أو الأرباح أو العملاء</strong>. تعتمد النتائج على: المنتج، السعر، جودة المحتوى، السوق، الميزانية، جودة الموقع، وظروف المنصة الإعلانية.</div>

      {/* ── ART 12 ── */}
      <Article num="12" title="الحسابات الإعلانية" />
      <div style={{ fontSize: 12.5 }}>تبقى ملكية الحسابات الإعلانية والصفحات والأصول الرقمية الخاصة بالعميل للعميل. تقتصر صلاحيات الوكالة على إدارة الحملات وتنفيذ الخدمات المتفق عليها.</div>

      {/* ── ART 13 ── */}
      <Article num="13" title="السرية" />
      <div style={{ fontSize: 12.5 }}>يتعهد الطرفان بالحفاظ على سرية جميع المعلومات والبيانات: بيانات الحملات، بيانات العملاء، البيانات المالية، الاستراتيجيات، معلومات المنتجات، بيانات الحسابات.</div>

      {/* ── ART 14 ── */}
      <Article num="14" title="مدة العقد" />
      <div style={{ fontSize: 13, lineHeight: 2 }}>
        تبدأ مدة العقد بتاريخ: <strong>{contract.startDate ? formatDateStr(contract.startDate) : "_____ / _____ / _________"}</strong>
        {contract.endDate
          ? <span> وتستمر حتى: <strong>{formatDateStr(contract.endDate)}</strong></span>
          : <span> وتستمر لمدة: <span style={{ ...S.blankLine, minWidth: 120 }} /></span>
        }
      </div>

      {/* ── ART 15 ── */}
      <Article num="15" title="إنهاء العقد" />
      <div style={{ fontSize: 12.5 }}>يمكن لأي طرف إنهاء التعاون من خلال إشعار الطرف الآخر قبل: <span style={{ ...S.blankLine, minWidth: 60 }} /> <strong>يومًا</strong>. تظل جميع الأتعاب المستحقة عن الخدمات والإنفاق الإعلاني المنفذ حتى تاريخ الإنهاء واجبة الدفع.</div>

      {/* ── ART 16 ── */}
      <Article num="16" title="تعليق الخدمة" />
      {["عدم دفع الأتعاب", "عدم توفير الميزانية الإعلانية", "عدم توفير المعلومات أو المواد المطلوبة", "مخالفة العميل لشروط المنصات الإعلانية", "طلب تنفيذ أعمال غير قانونية أو مخالفة لسياسات المنصات"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 17 ── */}
      <Article num="17" title="المسؤولية" />
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>لا تتحمل الوكالة مسؤولية المشاكل الناتجة عن:</div>
      {["حظر الحساب الإعلاني من طرف المنصة", "رفض الإعلانات من طرف المنصة", "تغييرات خوارزميات المنصات", "مشاكل الدفع الخاصة بالعميل", "مشاكل الموقع أو الاستضافة", "مشاكل المنتج أو المخزون", "تأخر العميل في معالجة الطلبات", "أسباب خارجة عن سيطرة الوكالة"].map((s, i) => <Li key={i}>{s}</Li>)}

      {/* ── ART 18 ── */}
      <Article num="18" title="القانون وتسوية النزاعات" />
      <div style={{ fontSize: 12.5 }}>يسعى الطرفان أولًا إلى حل أي نزاع وديًا. وفي حال تعذر ذلك، يتم اللجوء إلى الجهات المختصة وفقًا للقوانين المعمول بها في <strong>الجمهورية الجزائرية</strong>.</div>

      {/* ── ART 19 ── */}
      <Article num="19" title="الموافقة" />
      <div style={{ fontSize: 12.5 }}>بتوقيع هذا العقد، يقر الطرفان بأنهما قرآ جميع البنود وفهما محتواها ووافقا عليها.</div>

      {/* Notes */}
      {contract.notes && (
        <div style={{ ...S.note, marginTop: 16 }}><strong>ملاحظات:</strong> {contract.notes}</div>
      )}

      {/* ── SIGNATURES ── */}
      <div style={{ marginTop: 48 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", borderBottom: "2px solid #1e293b", paddingBottom: 6, marginBottom: 32, textAlign: "center", color: "#1e40af" }}>
          التوقيعات
        </div>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "space-around" }}>
          <div style={S.sigBox}>
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>الطرف الأول – الوكالة</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{agency?.name || "Adpowers Digital"}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>الاسم: ___________________________</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>الصفة: ___________________________</div>
            <div style={S.stamp}>الختم</div>
            <div style={S.sigLine}>
              <div style={{ fontSize: 11, color: "#64748b" }}>التوقيع</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>التاريخ: _____ / _____ / _______</div>
            </div>
          </div>
          <div style={S.sigBox}>
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>الطرف الثاني – العميل</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{clientName}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>الاسم: ___________________________</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>الصفة: ___________________________</div>
            <div style={S.stamp}>الختم</div>
            <div style={S.sigLine}>
              <div style={{ fontSize: 11, color: "#64748b" }}>التوقيع</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>التاريخ: _____ / _____ / _______</div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.footer}>
        {agency?.name} — {agency?.address} — {agency?.phone}
        <br />محرر من نسختين أصليتين / Établi en deux exemplaires originaux
      </div>
    </div>
  );
}

function formatDateStr(dateStr) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "yyyy-MM-dd");
  } catch {
    return dateStr;
  }
}
