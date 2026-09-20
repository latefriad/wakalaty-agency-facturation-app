import { useState, useEffect } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { api, apiUpload, apiDownload } from "../services/api";

const ROLES = [
  { value: "ADMIN", key: "role.ADMIN", icon: "👑" },
  { value: "EDITOR", key: "role.EDITOR", icon: "✍️" },
  { value: "DESIGNER", key: "role.DESIGNER", icon: "🎨" },
  { value: "ADS", key: "role.ADS", icon: "📢" },
  { value: "VIDEO", key: "role.VIDEO", icon: "🎬" },
  { value: "SEO", key: "role.SEO", icon: "🔍" },
  { value: "EMPLOYEE", key: "role.EMPLOYEE", icon: "👤" },
];

const JOB_TYPES = [
  { value: "salarie", key: "emp.permanent", icon: "👔" },
  { value: "freelancer", key: "emp.freelancer", icon: "💼" },
];

const CONTRACT_TYPES = ["CDI", "CDD", "STAGE", "FREELANCE", "AUTRE"];

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "employee",
  phone: "",
  tasks: [],
  notes: "",
  salary: "",
  hireDate: "",
  contractType: "",
  managerId: "",
  isPaid: false,
  paymentDate: "",
  jobType: "salarie",
  commissionRate: "",
  commissionBalance: 0,
  commissionPaid: 0,
};

export default function Employees() {
  const { t } = useLang();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Demandes de congés en attente de décision (GET /leaves?status=PENDING).
  const [pendingLeaves, setPendingLeaves] = useState([]);
  // Vue liste ou organigramme (hiérarchie managerId).
  const [view, setView] = useState("grid");
  // Pointages du jour (GET /attendance, défaut = aujourd'hui).
  const [todayAttendance, setTodayAttendance] = useState([]);
  // Modale documents RH de l'employé sélectionné.
  const [docsEmp, setDocsEmp] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  if (!isAdmin) {
    return (
      <div style={{ direction: "inherit", padding: 24, fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
        <h2>Unauthorized</h2>
        <p>{t("emp.adminOnly")}</p>
      </div>
    );
  }

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get("/employees", { limit: 100 });
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchPendingLeaves = async () => {
    try {
      const res = await api.get("/leaves", { status: "PENDING" });
      setPendingLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const res = await api.get("/attendance");
      setTodayAttendance(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchPendingLeaves();
    fetchTodayAttendance();
  }, []);

  // Documents RH : upload multipart + téléchargement authentifié (les
  // fichiers ne sont pas exposés en statique).
  const openDocs = async (emp) => {
    setDocsEmp(emp);
    try {
      const res = await api.get(`/employees/${emp.id}/documents`);
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUploadDoc = async (file) => {
    if (!file || !docsEmp) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name);
      await apiUpload(`/employees/${docsEmp.id}/documents`, fd);
      toast.success(t("emp.docUploaded"));
      await openDocs(docsEmp);
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
    setUploading(false);
  };

  const handleDeleteDoc = async (docId) => {
    if (!(await confirm(t("common.confirmDelete")))) return;
    try {
      await api.delete(`/employees/${docsEmp.id}/documents/${docId}`);
      await openDocs(docsEmp);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const decideLeave = async (id, action) => {
    try {
      await api.patch(`/leaves/${id}/${action}`, {});
      toast.success(t(action === "approve" ? "leave.approvedToast" : "leave.rejectedToast"));
      fetchPendingLeaves();
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t("emp.nameRequired"));
    if (!editEmp && !form.email.trim()) return toast.error(t("emp.emailRequired"));
    if (!editEmp && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error(t("emp.emailInvalid"));

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        position: form.position,
        salary: parseFloat(form.salary) || 0,
        hireDate: form.hireDate || null,
        contractType: form.contractType || null,
        managerId: form.managerId || null,
        jobType: form.jobType || "salarie",
        commissionRate: parseFloat(form.commissionRate) || 0,
        commissionBalance: editEmp?.commissionBalance || 0,
        commissionPaid: editEmp?.commissionPaid || 0,
        isPaid: form.isPaid,
      };

      if (editEmp) {
        await api.put(`/employees/${editEmp.id}`, payload);
      } else {
        await api.post("/employees", {
          ...payload,
          email: form.email,
        });
      }
      setSaving(false);
      setShowModal(false);
      setForm(emptyForm);
      toast.success(t(editEmp ? "common.saved" : "common.created"));
      setEditEmp(null);
      fetchEmployees();
    } catch (err) {
      setSaving(false);
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  // Offboarding (pas de suppression) : l'accès est révoqué immédiatement,
  // la fiche et l'historique restent.
  const handleOffboard = async (emp) => {
    if (!(await confirm(t("emp.offboardConfirm")))) return;
    try {
      await api.post(`/employees/${emp.id}/offboard`);
      fetchEmployees();
      toast.success(t("emp.offboarded"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const handleReactivate = async (emp) => {
    try {
      await api.post(`/employees/${emp.id}/reactivate`);
      fetchEmployees();
      toast.success(t("emp.reactivated"));
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  // Invitation : le serveur envoie l'e-mail (ou renvoie le lien à partager si
  // le SMTP n'est pas configuré). L'invité choisit son mot de passe.
  const handleInvite = async (emp) => {
    try {
      const res = await api.post("/users/invite", { email: emp.email, name: emp.name, role: "EMPLOYEE" });
      if (res.data?.inviteUrl) {
        await navigator.clipboard.writeText(res.data.inviteUrl).catch(() => {});
        toast.success(t("emp.inviteLinkCopied"), { duration: 6000 });
      } else {
        toast.success(t("emp.inviteSent"));
      }
    } catch (err) {
      toast.error(t("common.error") + ": " + err.message);
    }
  };

  const openEdit = (emp) => {
    setEditEmp(emp);
    setForm({
      name: emp.name || "",
      email: emp.email || "",
      phone: emp.phone || "",
      position: emp.position || "",
      salary: emp.salary || "",
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : "",
      contractType: emp.contractType || "",
      managerId: emp.managerId || "",
      jobType: emp.jobType || "salarie",
      commissionRate: emp.commissionRate || "",
      commissionBalance: emp.commissionBalance || 0,
      commissionPaid: emp.commissionPaid || 0,
      isPaid: emp.isPaid || false,
    });
    setShowModal(true);
  };

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length] || colors[0];
  const getInitials = (name) => name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  const filtered = employees.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 {t("emp.title")}</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>{employees.length} {t("emp.registered")}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView(view === "grid" ? "tree" : "grid")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 13 }}>
            {view === "grid" ? "🌳 " + t("emp.orgChart") : "🔲 " + t("emp.gridView")}
          </button>
          {isAdmin && (
            <button onClick={() => { setForm(emptyForm); setEditEmp(null); setShowModal(true); }} className="btn-primary">
              + {t("emp.addEmployee")}
            </button>
          )}
        </div>
      </div>

      {/* Présence du jour (pointages) */}
      {todayAttendance.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderInlineStart: "4px solid #3b82f6" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
            🕒 {t("att.todayTitle")} ({todayAttendance.filter((e) => !e.clockOut).length} {t("att.present")})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayAttendance.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: e.clockOut ? "#f8fafc" : "#f0fdf4", border: `1px solid ${e.clockOut ? "#f1f5f9" : "#bbf7d0"}`, fontSize: 13, flexWrap: "wrap" }}>
                <span>
                  {e.clockOut ? "◽" : "🟢"} <strong>{e.employee?.name}</strong>
                  {e.employee?.position && <span style={{ color: "#94a3b8", fontSize: 12 }}> · {e.employee.position}</span>}
                </span>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {new Date(e.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {e.clockOut
                    ? ` → ${new Date(e.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${Math.floor((e.minutes || 0) / 60)}h${String((e.minutes || 0) % 60).padStart(2, "0")})`
                    : ` → ${t("att.inProgress")}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Congés en attente : visibles uniquement ici (page admin) */}
      {pendingLeaves.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderInlineStart: "4px solid #f59e0b" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
            🏖️ {t("leave.pendingTitle")} ({pendingLeaves.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingLeaves.map((lr) => (
              <div key={lr.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{lr.employee?.name}</strong>
                  {" — "}
                  {t(`leave.${lr.type.toLowerCase()}`)} · {lr.days} {t("leave.days")}
                  <div style={{ fontSize: 11, color: "#92400e" }}>
                    {new Date(lr.startDate).toLocaleDateString()} → {new Date(lr.endDate).toLocaleDateString()}
                    {lr.reason && ` · ${lr.reason}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => decideLeave(lr.id, "approve")} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    ✓ {t("leave.approve")}
                  </button>
                  <button onClick={() => decideLeave(lr.id, "reject")} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    ✕ {t("leave.reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input placeholder={"🔍 " + t("emp.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="form-input" style={{ marginBottom: 20, maxWidth: 400 }} />

      {loading && <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>{t("common.loading")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div>{search ? t("common.noResults") : t("emp.empty")}</div>
        </div>
      )}

      {/* Organigramme : arbre par manager direct (racines = sans manager) */}
      {view === "tree" && !loading && employees.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          {(() => {
            const byManager = {};
            employees.forEach((e) => {
              const k = e.managerId && employees.some((m) => m.id === e.managerId) ? e.managerId : "root";
              (byManager[k] = byManager[k] || []).push(e);
            });
            const renderNode = (emp, depth) => (
              <div key={emp.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginInlineStart: depth * 26, borderInlineStart: depth > 0 ? "2px solid #e2e8f0" : "none", marginBottom: 4, background: "#f8fafc", borderRadius: 8, opacity: emp.status === "OFFBOARDED" ? 0.6 : 1 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: getColor(emp.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {getInitials(emp.name)}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</span>
                    {emp.position && <span style={{ color: "#64748b", fontSize: 12 }}> — {emp.position}</span>}
                    {emp.status === "OFFBOARDED" && <span style={{ color: "#94a3b8", fontSize: 11 }}> · 🚫 {t("emp.offboardedBadge")}</span>}
                    {(byManager[emp.id] || []).length > 0 && (
                      <span style={{ color: "#3b82f6", fontSize: 11 }}> · {(byManager[emp.id] || []).length} 👥</span>
                    )}
                  </div>
                </div>
                {(byManager[emp.id] || []).map((c) => renderNode(c, depth + 1))}
              </div>
            );
            return (byManager.root || []).map((e) => renderNode(e, 0));
          })()}
        </div>
      )}

      <div className="cards-grid" style={{ display: view === "tree" ? "none" : undefined }}>
        {filtered.map((emp) => (
          <div key={emp.id} className="card" style={{ borderTop: `3px solid ${getColor(emp.name)}`, opacity: emp.status === "OFFBOARDED" ? 0.65 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: getColor(emp.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                {getInitials(emp.name)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{emp.email}</div>
              </div>
            </div>

            {emp.status === "OFFBOARDED" && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ background: "#f1f5f9", color: "#64748b", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  🚫 {t("emp.offboardedBadge")}
                </span>
              </div>
            )}

            {/* Job Type Badge */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: emp.jobType === "freelancer" ? "#fef3c7" : "#dbeafe",
                color: emp.jobType === "freelancer" ? "#92400e" : "#1e40af",
                padding: "4px 12px", borderRadius: 20,
                fontSize: 12, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 4
              }}>
                {emp.jobType === "freelancer" ? "💼 " + t("emp.freelancer") : "👔 " + t("emp.permanent")}
              </span>
            </div>

            {emp.position && (
              <span style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, display: "inline-block", marginBottom: 10 }}>
                {emp.position}
              </span>
            )}

            {(emp.contractType || emp.hireDate || emp.manager) && (
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {emp.contractType && <span>📄 {t(`emp.contract.${emp.contractType}`)}</span>}
                {emp.hireDate && <span>📅 {t("emp.hiredOn")} {new Date(emp.hireDate).toLocaleDateString()}</span>}
                {emp.manager && <span>👤 {t("emp.manager")}: {emp.manager.name}</span>}
              </div>
            )}

            {/* Commission balance for freelancers */}
            {emp.jobType === "freelancer" && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
                background: emp.isPaid ? "#d1fae5" : "#fef3c7",
                marginBottom: 10, fontSize: 13
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: emp.isPaid ? "#065f46" : "#92400e" }}>
                    💼 {(emp.commissionBalance || 0).toFixed(2)} {t("common.currency")}
                  </div>
                  <div style={{ fontSize: 11, color: emp.isPaid ? "#065f46" : "#92400e" }}>
                    {t("emp.totalCommissions")}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: emp.isPaid ? "#10b981" : "#f59e0b" }}>
                    {emp.isPaid ? "✅ " + t("emp.paidF") : "⏳ " + t("emp.pending")}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    {emp.commissionRate || 0}% {t("emp.commissionRate")}
                  </div>
                </div>
              </div>
            )}

            {/* Salary for salarié */}
            {emp.jobType === "salarie" && emp.salary > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8,
                background: emp.isPaid ? "#d1fae5" : "#fef3c7",
                marginBottom: 10, fontSize: 13
              }}>
                <span style={{ fontWeight: 600 }}>💰 {parseFloat(emp.salary).toLocaleString()} {t("common.currency")}</span>
                <span style={{ color: emp.isPaid ? "#10b981" : "#f59e0b", fontWeight: 600, fontSize: 12 }}>
                  {emp.isPaid ? "✅ " + t("emp.paid") : "⏳ " + t("emp.pending")}
                </span>
              </div>
            )}

            {isAdmin && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => openEdit(emp)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 13 }}>{t("common.edit")}</button>
                <button onClick={() => openDocs(emp)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 13 }}>📎 {t("emp.documents")}</button>
                {emp.email && !emp.userId && emp.status !== "OFFBOARDED" && (
                  <button onClick={() => handleInvite(emp)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: 13 }}>
                    ✉️ {t("emp.invite")}
                  </button>
                )}
                {emp.status !== "OFFBOARDED" ? (
                  <button onClick={() => handleOffboard(emp)} className="btn-danger" style={{ flex: 1, padding: "8px 0", borderRadius: 8 }}>{t("emp.offboard")}</button>
                ) : (
                  <button onClick={() => handleReactivate(emp)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontSize: 13 }}>
                    ↩️ {t("emp.reactivate")}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Documents RH de l'employé sélectionné */}
      {docsEmp && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>📎 {t("emp.documents")} — {docsEmp.name}</h2>

            <label style={{ display: "block", padding: "14px 0", borderRadius: 10, border: "2px dashed #cbd5e1", textAlign: "center", cursor: "pointer", marginBottom: 16, color: "#64748b", fontSize: 13 }}>
              {uploading ? t("common.saving") : "⬆️ " + t("emp.uploadDoc")}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: "none" }} disabled={uploading}
                onChange={(e) => { handleUploadDoc(e.target.files[0]); e.target.value = ""; }} />
            </label>

            {docs.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: 16, fontSize: 13 }}>{t("emp.noDocs")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                {docs.map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{(d.size / 1024).toFixed(0)} Ko · {new Date(d.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => apiDownload(`/employees/${docsEmp.id}/documents/${d.id}/download`, d.name).catch((err) => toast.error(err.message))}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: 12 }}>
                        ⬇️
                      </button>
                      <button onClick={() => handleDeleteDoc(d.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => { setDocsEmp(null); setDocs([]); }} style={{ width: "100%", marginTop: 16, padding: "10px 0", borderRadius: 10, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 14 }}>
              {t("common.close")}
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>{editEmp ? "✏️ " + t("emp.editEmployee") : "➕ " + t("emp.newEmployee")}</h2>

            <label className="form-label">{t("clients.fullNameLabel")}</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("clients.namePlaceholder")} className="form-input" style={{ marginBottom: 14 }} />

            <label className="form-label">{t("auth.emailLabel")}</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="employee@agence.com" disabled={!!editEmp} className="form-input" style={{ marginBottom: 14, background: editEmp ? "#f8fafc" : "#fff" }} />

            <label className="form-label">{t("common.phone")}</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+213 555 000 000" className="form-input" style={{ marginBottom: 14 }} />

            <label className="form-label">{t("emp.position")}</label>
            <input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={t("role.DESIGNER")} className="form-input" style={{ marginBottom: 14 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label">📅 {t("emp.hireDate")}</label>
                <input type="date" value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} className="form-input" style={{ marginBottom: 14 }} />
              </div>
              <div>
                <label className="form-label">📄 {t("emp.contractType")}</label>
                <select value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))} className="form-input" style={{ marginBottom: 14 }}>
                  <option value="">—</option>
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{t(`emp.contract.${ct}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="form-label">👤 {t("emp.manager")}</label>
            <select value={form.managerId} onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))} className="form-input" style={{ marginBottom: 14 }}>
              <option value="">—</option>
              {employees
                .filter((e) => e.id !== editEmp?.id && e.status !== "OFFBOARDED")
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.position ? ` (${e.position})` : ""}</option>
                ))}
            </select>

            {/* Job Type */}
            <label className="form-label">{t("emp.jobType")}</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {JOB_TYPES.map((jt) => (
                <button key={jt.value} type="button"
                  onClick={() => setForm((f) => ({ ...f, jobType: jt.value }))}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 10,
                    border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600,
                    background: form.jobType === jt.value
                      ? (jt.value === "freelancer" ? "#f59e0b" : "#3b82f6")
                      : "#f1f5f9",
                    color: form.jobType === jt.value ? "#fff" : "#64748b",
                    fontFamily: "'Segoe UI',Tahoma,sans-serif"
                  }}>
                  {jt.icon} {t(jt.key)}
                </button>
              ))}
            </div>

            {/* Salarié fields */}
            {form.jobType === "salarie" && (
              <>
                <label className="form-label">💰 {t("emp.monthlySalary")}</label>
                <input type="number" value={form.salary}
                  onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                  placeholder="0.00"
                  className="form-input"
                  style={{ marginBottom: 14 }} />

                <label className="form-label">{t("emp.salaryStatus")}</label>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {[
                    { val: false, label: "⏳ " + t("emp.pending") },
                    { val: true, label: "✅ " + t("emp.paid") }
                  ].map((opt) => (
                    <button key={String(opt.val)} type="button"
                      onClick={() => setForm((f) => ({ ...f, isPaid: opt.val }))}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 8,
                        border: "none", cursor: "pointer",
                        fontSize: 13, fontWeight: 500,
                        background: form.isPaid === opt.val ? "#3b82f6" : "#f1f5f9",
                        color: form.isPaid === opt.val ? "#fff" : "#64748b",
                        fontFamily: "'Segoe UI',Tahoma,sans-serif"
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Freelancer fields */}
            {form.jobType === "freelancer" && (
              <>
                <div style={{
                  background: "#fef3c7", border: "1px solid #fcd34d",
                  borderRadius: 10, padding: "12px 14px",
                  marginBottom: 14, fontSize: 13, color: "#92400e"
                }}>
                  💼 {t("emp.freelanceHint")}
                </div>

                <label className="form-label">📊 {t("emp.defaultCommission")}</label>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input type="number" value={form.commissionRate}
                    onChange={(e) => setForm((f) => ({
                      ...f, commissionRate: e.target.value
                    }))}
                    placeholder={t("emp.example20")}
                    min="0" max="100"
                    className="form-input"
                    style={{ paddingLeft: 40 }} />
                  <span style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8", fontSize: 16
                  }}>%</span>
                </div>

                {/* Commission Balance Display */}
                {editEmp && (
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr",
                    gap: 10, marginBottom: 14
                  }}>
                    <div style={{
                      background: "#d1fae5", borderRadius: 10,
                      padding: "12px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#065f46" }}>
                        {(editEmp.commissionBalance || 0).toFixed(2)} {t("common.currency")}
                      </div>
                      <div style={{ fontSize: 11, color: "#065f46" }}>
                        {t("emp.totalCommissions")}
                      </div>
                    </div>
                    <div style={{
                      background: "#dbeafe", borderRadius: 10,
                      padding: "12px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>
                        {((editEmp.commissionBalance || 0) - (editEmp.commissionPaid || 0)).toFixed(2)} {t("common.currency")}
                      </div>
                      <div style={{ fontSize: 11, color: "#1e40af" }}>
                        {t("emp.unpaid")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mark commission as paid */}
                {editEmp && (
                  <>
                    <label className="form-label">{t("emp.commissionStatus")}</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                      {[
                        { val: false, label: "⏳ " + t("emp.pending") },
                        { val: true, label: "✅ " + t("emp.paidF") }
                      ].map((opt) => (
                        <button key={String(opt.val)} type="button"
                          onClick={() => setForm((f) => ({
                            ...f, isPaid: opt.val
                          }))}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: 8,
                            border: "none", cursor: "pointer",
                            fontSize: 13, fontWeight: 500,
                            background: form.isPaid === opt.val ? "#f59e0b" : "#f1f5f9",
                            color: form.isPaid === opt.val ? "#fff" : "#64748b",
                            fontFamily: "'Segoe UI',Tahoma,sans-serif"
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 15 }}>
                {saving ? t("common.saving") : editEmp ? t("clients.saveEdits") : t("emp.addBtn")}
              </button>
              <button onClick={() => { setShowModal(false); setEditEmp(null); setForm(emptyForm); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 14 }}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
