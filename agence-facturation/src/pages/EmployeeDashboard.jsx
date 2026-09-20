import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api, apiDownload } from "../services/api";
import toast from "react-hot-toast";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Calendar,
  Briefcase,
} from "lucide-react";

const STATUS_META = {
  pending: { key: "empDash.pendingStatus", color: "#6b7280", bg: "#f3f4f6", icon: Clock },
  in_progress: { key: "empDash.inProgressStatus", color: "#3b82f6", bg: "#dbeafe", icon: AlertCircle },
  completed: { key: "empDash.completedStatus", color: "#10b981", bg: "#d1fae5", icon: CheckCircle },
};

// Le backend parle TODO/INPROGRESS/DONE ; le composant garde son vocabulaire
// local historique (pending/in_progress/completed) via ces deux mappings.
const BACKEND_TO_LOCAL = { TODO: "pending", INPROGRESS: "in_progress", DONE: "completed" };
const LOCAL_TO_BACKEND = { pending: "TODO", in_progress: "INPROGRESS", completed: "DONE" };

const LEAVE_STATUS_META = {
  PENDING: { key: "leave.pending", color: "#f59e0b", bg: "#fef3c7" },
  APPROVED: { key: "leave.approved", color: "#10b981", bg: "#d1fae5" },
  REJECTED: { key: "leave.rejected", color: "#ef4444", bg: "#fee2e2" },
  CANCELLED: { key: "leave.cancelledStatus", color: "#64748b", bg: "#f1f5f9" },
};

const LEAVE_TYPES = [
  { value: "ANNUAL", key: "leave.annual" },
  { value: "SICK", key: "leave.sick" },
  { value: "UNPAID", key: "leave.unpaid" },
  { value: "EXCEPTIONAL", key: "leave.exceptional" },
];

export default function EmployeeDashboard() {
  const { t } = useLang();
  const { profile, agency, agencyId } = useAuth();
  const [myTasks, setMyTasks] = useState([]);
  const [taskGroups, setTaskGroups] = useState({ overdue: [], today: [], upcoming: [], noDate: [] });
  const [doneCount, setDoneCount] = useState(0);
  // Fiche RH de l'employé connecté (GET /employees/me) : salaire, type de
  // contrat, commissions… Null si aucune fiche employé n'est liée au compte.
  const [hr, setHr] = useState(null);
  const [commissions, setCommissions] = useState([]);
  // Congés : demandes + solde de l'employé connecté (GET /leaves/my).
  const [leaves, setLeaves] = useState(null);
  // Documents RH de l'employé connecté (contrats, attestations…).
  const [myDocs, setMyDocs] = useState([]);
  // Pointage : entrée en cours + historique + totaux (GET /attendance/my).
  const [attendance, setAttendance] = useState(null);
  const [clocking, setClocking] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);
  const [loading, setLoading] = useState(true);
  const primary = agency?.primaryColor || "#3b82f6";

  // /tasks/my : le serveur relie le compte à sa fiche employé (Employee.userId)
  // et sectionne déjà retard/aujourd'hui/à venir — plus de filtrage client
  // approximatif sur des ids qui ne correspondaient pas.
  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/my");
      const groups = res.data || {};
      const normalize = (t) => ({ ...t, status: BACKEND_TO_LOCAL[t.status] || "pending" });
      const sections = {
        overdue: (groups.overdue || []).map(normalize),
        today: (groups.today || []).map(normalize),
        upcoming: (groups.upcoming || []).map(normalize),
        noDate: (groups.noDate || []).map(normalize),
      };
      setTaskGroups(sections);
      // Ordre d'affichage : le plus urgent d'abord.
      setMyTasks([...sections.overdue, ...sections.today, ...sections.upcoming, ...sections.noDate]);
      setDoneCount(groups.doneCount || 0);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  // Le serveur ne renvoie que la fiche liée au compte connecté (404 si le
  // compte n'a pas de fiche employé) : aucune donnée d'un collègue ne
  // transite, contrairement à l'ancien filtrage côté client.
  const fetchProfile = async () => {
    try {
      const res = await api.get("/employees/me");
      setHr(res.data || null);
      return res.data;
    } catch (err) {
      if (err.status !== 404) console.error("Failed to fetch HR profile:", err);
      setHr(null);
      return null;
    }
  };

  const fetchCommissions = async () => {
    try {
      const res = await api.get("/employees/me/commissions");
      setCommissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch commissions:", err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await api.get("/attendance/my");
      setAttendance(res.data);
    } catch (err) {
      if (err.status !== 404) console.error("Failed to fetch attendance:", err);
      setAttendance(null);
    }
  };

  // L'heure est celle du serveur : on ne fait qu'annoncer l'action.
  const handleClock = async () => {
    setClocking(true);
    try {
      if (attendance?.open) {
        await api.post("/attendance/clock-out", {});
        toast.success(t("att.clockedOut"));
      } else {
        await api.post("/attendance/clock-in", {});
        toast.success(t("att.clockedIn"));
      }
      await fetchAttendance();
    } catch (err) {
      toast.error(err.message);
    }
    setClocking(false);
  };

  const fetchMyDocs = async () => {
    try {
      const res = await api.get("/employees/me/documents");
      setMyDocs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err.status !== 404) console.error("Failed to fetch documents:", err);
      setMyDocs([]);
    }
  };

  const fetchLeaves = async () => {
    try {
      const res = await api.get("/leaves/my");
      setLeaves(res.data);
    } catch (err) {
      // 404 = pas de fiche employé liée : la carte congés ne s'affiche pas.
      if (err.status !== 404) console.error("Failed to fetch leaves:", err);
      setLeaves(null);
    }
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate) return toast.error(t("leave.datesRequired"));
    setSavingLeave(true);
    try {
      await api.post("/leaves", leaveForm);
      toast.success(t("leave.requested"));
      setShowLeaveForm(false);
      setLeaveForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      await fetchLeaves();
    } catch (err) {
      toast.error(err.message);
    }
    setSavingLeave(false);
  };

  const cancelLeave = async (id) => {
    try {
      await api.patch(`/leaves/${id}/cancel`);
      toast.success(t("leave.cancelled"));
      await fetchLeaves();
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadAll = async () => {
      setLoading(true);
      const [, hrData] = await Promise.all([fetchTasks(), fetchProfile(), fetchLeaves(), fetchMyDocs(), fetchAttendance()]);
      if (hrData?.jobType === "freelancer") {
        await fetchCommissions();
      }
      if (isMounted) setLoading(false);
    };

    loadAll();

    const interval = setInterval(() => {
      if (isMounted) loadAll();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [profile?.id]);

  // Le solde cumulé (commissionBalance) vient de la fiche ; l'historique
  // liste les services commissionnés du freelance connecté.
  const totalCommission = hr?.commissionBalance || 0;
  const paidCommission = hr?.commissionPaid || 0;
  const unpaidCommission = totalCommission - paidCommission;

  const getRoleLabel = (role) =>
    ({
      ADMIN: t("role.ADMIN"),
      EDITOR: t("role.EDITOR"),
      DESIGNER: t("role.DESIGNER"),
      ADS: t("role.ADS"),
      VIDEO: t("role.VIDEO"),
      SEO: t("role.SEO"),
      EMPLOYEE: t("role.EMPLOYEE"),
    }[role] || t("role.EMPLOYEE"));

  const getPriorityColor = (p) =>
    ({
      HIGH: { color: "#ef4444", bg: "#fee2e2", label: t("empDash.urgent") },
      MEDIUM: { color: "#f59e0b", bg: "#fef3c7", label: t("tasks.medium") },
      LOW: { color: "#10b981", bg: "#d1fae5", label: t("empDash.normal") },
    }[p] || { color: "#64748b", bg: "#f1f5f9", label: t("empDash.normal") });

  const getTypeLabel = (ty) =>
    ({
      DAILY: t("tasks.daily"),
      WEEKLY: t("tasks.weekly"),
      PROJECT: t("tasks.project"),
    }[ty] || ty);

  const pendingTasks = useMemo(
    () => myTasks.filter((t) => t.status === "pending" || t.status === "in_progress"),
    [myTasks]
  );

  const todayTasks = taskGroups.today;
  const overdueTasks = taskGroups.overdue;

  const totalTasks = myTasks.length + doneCount;
  const completionRate = useMemo(() => {
    if (totalTasks === 0) return 0;
    return Math.round((doneCount / totalTasks) * 100);
  }, [doneCount, totalTasks]);

  // La route serveur est PATCH (et limite un employé à status/order sur SES
  // tâches) ; statut re-mappé vers le vocabulaire backend.
  const updateTask = async (taskId, patch) => {
    try {
      const payload = { ...patch };
      if (payload.status) payload.status = LOCAL_TO_BACKEND[payload.status] || payload.status;
      await api.patch(`/tasks/${taskId}`, payload);
      toast.success(t("empDash.taskUpdated"));
      await fetchTasks();
    } catch (err) {
      console.error("Failed to update task:", err);
      toast.error(t("empDash.taskUpdateError"));
    }
  };

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${primary}, ${primary}bb)`,
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 24,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{t("empDash.welcomeYou")}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          {profile?.name || t("empDash.employee")}
        </div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {getRoleLabel(profile?.role)} — {agency?.name}
          {hr?.jobType === "freelancer" && (
            <span style={{ marginRight: 8, background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 20, fontSize: 12 }}>
              {t("empDash.freelancerBadge")}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {(hr?.jobType === "freelancer"
          ? [
              {
                label: t("empDash.todayTasks"),
                value: todayTasks.length,
                icon: <Calendar size={20} />,
                color: "#3b82f6",
                bg: "#dbeafe",
              },
              {
                label: t("empDash.dueCommissions"),
                value: `${unpaidCommission.toFixed(0)} $${t("common.currency")}`,
                icon: <TrendingUp size={20} />,
                color: "#f59e0b",
                bg: "#fef3c7",
              },
              {
                label: t("empDash.totalCommissions"),
                value: `${totalCommission.toFixed(0)} $${t("common.currency")}`,
                icon: <DollarSign size={20} />,
                color: "#10b981",
                bg: "#d1fae5",
              },
            ]
          : [
              {
                label: t("empDash.todayTasks"),
                value: todayTasks.length,
                icon: <Calendar size={20} />,
                color: "#f59e0b",
                bg: "#fef3c7",
              },
              {
                label: t("tasks.late"),
                value: overdueTasks.length,
                icon: <AlertCircle size={20} />,
                color: "#ef4444",
                bg: "#fee2e2",
              },
              {
                label: t("empDash.inProgressTasks"),
                value: pendingTasks.length,
                icon: <Clock size={20} />,
                color: "#3b82f6",
                bg: "#dbeafe",
              },
              {
                label: t("empDash.doneTasks"),
                value: doneCount,
                icon: <CheckCircle size={20} />,
                color: "#10b981",
                bg: "#d1fae5",
              },
            ]
        ).map((s) => (
          <div
            key={s.label}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 14 }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.color,
                flexShrink: 0,
              }}
            >
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* My Tasks */}
        <div className="card">
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
            <Briefcase size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
            {t("empDash.myTasks")}
          </h3>

          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>
              {t("common.loading")}
            </div>
          ) : myTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>
              <CheckCircle size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
              {t("empDash.noTasks")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myTasks.slice(0, 10).map((task) => {
                const pr = getPriorityColor(task.priority);
                const st = STATUS_META[task.status] || STATUS_META.pending;
                const StatusIcon = st.icon;

                const canStart = task.status === "pending";
                const canComplete = task.status === "in_progress";

                return (
                  <div
                    key={task.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: task.status === "completed" ? "#f8fafc" : "#fff",
                      border: `1px solid ${task.status === "completed" ? "#e2e8f0" : "#dbeafe"}`,
                      borderRight: `4px solid ${task.status === "completed" ? "#10b981" : primary}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: st.color,
                            textDecoration:
                              task.status === "completed" ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          {getTypeLabel(task.type)}
                          {task.dueDate && ` • 📅 ${new Date(task.dueDate).toLocaleDateString()}`}
                          {task.client?.name && ` • 🏢 ${task.client.name}`}
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: 999,
                              color: st.color,
                              background: st.bg,
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <StatusIcon size={12} />
                            {t(st.key)}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              padding: "4px 10px",
                              borderRadius: 999,
                              color: pr.color,
                              background: pr.bg,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pr.label}
                          </span>

                          {task.isOverdue && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 999,
                                color: "#ef4444",
                                background: "#fee2e2",
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              ⚠️ {t("tasks.late")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {canStart && (
                        <button
                          onClick={() => updateTask(task.id, { status: "in_progress" })}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "none",
                            cursor: "pointer",
                            background: "#3b82f6",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {t("empDash.start")}
                        </button>
                      )}
                      {canComplete && (
                        <button
                          onClick={() => updateTask(task.id, { status: "completed" })}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "none",
                            cursor: "pointer",
                            background: "#10b981",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {t("empDash.complete")}
                        </button>
                      )}
                      {!canStart && !canComplete && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            fontWeight: 700,
                            paddingTop: 8,
                          }}
                        >
                          {t("empDash.taskStatus")}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Profile + Salary/Commission + Performance */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* My Info */}
          <div className="card">
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{t("empDash.myProfile")}</h3>
            {[
              { label: t("common.name"), value: profile?.name },
              { label: t("common.email"), value: profile?.email },
              { label: t("common.phone"), value: hr?.phone },
              { label: t("empDash.position"), value: hr?.position || getRoleLabel(profile?.role) },
              { label: t("empDash.typeLabel"), value: hr ? (hr.jobType === "freelancer" ? "💼 " + t("emp.freelancer") : "👔 " + t("emp.permanent")) : null },
              { label: t("emp.hireDate"), value: hr?.hireDate ? new Date(hr.hireDate).toLocaleDateString() : null },
              { label: t("emp.contractType"), value: hr?.contractType ? t(`emp.contract.${hr.contractType}`) : null },
            ]
              .filter((i) => i.value)
              .map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#64748b" }}>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}

            {profile?.notes && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "#fef9c3",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#92400e",
                }}
              >
                {profile.notes}
              </div>
            )}
          </div>

          {/* Pointage : arrivée/départ horodatés serveur */}
          {attendance && (
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>🕒 {t("att.title")}</h3>

              {attendance.open ? (
                <div style={{ textAlign: "center", background: "#d1fae5", borderRadius: 12, padding: "12px 10px", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>✅ {t("att.working")}</div>
                  <div style={{ fontSize: 12, color: "#065f46", marginTop: 2 }}>
                    {t("att.since")} {new Date(attendance.open.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", background: "#f1f5f9", borderRadius: 12, padding: "12px 10px", marginBottom: 12, fontSize: 13, color: "#64748b" }}>
                  {t("att.notWorking")}
                </div>
              )}

              <button onClick={handleClock} disabled={clocking} className="btn-primary"
                style={{ width: "100%", padding: "12px 0", fontSize: 14, marginBottom: 14, background: attendance.open ? "#ef4444" : undefined, border: "none" }}>
                {clocking ? t("common.saving") : attendance.open ? "🔴 " + t("att.clockOut") : "🟢 " + t("att.clockIn")}
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: t("att.thisWeek"), min: attendance.totals.weekMinutes },
                  { label: t("att.thisMonth"), min: attendance.totals.monthMinutes },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6" }}>
                      {Math.floor(s.min / 60)}h{String(s.min % 60).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {attendance.entries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 150, overflowY: "auto", marginTop: 12 }}>
                  {attendance.entries.slice(0, 6).map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "6px 10px", background: "#f8fafc", borderRadius: 6, color: "#475569" }}>
                      <span>{new Date(e.clockIn).toLocaleDateString([], { day: "2-digit", month: "2-digit" })} · {new Date(e.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {e.clockOut ? ` → ${new Date(e.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ` → …`}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {e.minutes != null ? `${Math.floor(e.minutes / 60)}h${String(e.minutes % 60).padStart(2, "0")}` : "⏳"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Congés : solde + demande + historique (self-service) */}
          {leaves && (
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
                🏖️ {t("leave.myLeaves")}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: t("leave.remaining"), value: leaves.balance.remainingDays, color: "#10b981", bg: "#d1fae5" },
                  { label: t("leave.used"), value: leaves.balance.usedDays, color: "#f59e0b", bg: "#fef3c7" },
                  { label: t("leave.allocated"), value: leaves.balance.allocatedDays, color: "#3b82f6", bg: "#dbeafe" },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: s.color, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {!showLeaveForm ? (
                <button onClick={() => setShowLeaveForm(true)} className="btn-primary" style={{ width: "100%", padding: "10px 0", fontSize: 13, marginBottom: 14 }}>
                  + {t("leave.request")}
                </button>
              ) : (
                <form onSubmit={submitLeave} style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <label className="form-label">{t("leave.type")}</label>
                  <select value={leaveForm.type} onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))} className="form-input" style={{ marginBottom: 10 }}>
                    {LEAVE_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>{t(lt.key)}</option>
                    ))}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="form-label">{t("leave.from")}</label>
                      <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} className="form-input" style={{ marginBottom: 10 }} />
                    </div>
                    <div>
                      <label className="form-label">{t("leave.to")}</label>
                      <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} className="form-input" style={{ marginBottom: 10 }} />
                    </div>
                  </div>
                  <input value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("leave.reasonPlaceholder")} className="form-input" style={{ marginBottom: 10 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={savingLeave} className="btn-primary" style={{ flex: 2, padding: "9px 0", fontSize: 13 }}>
                      {savingLeave ? t("common.saving") : t("leave.submit")}
                    </button>
                    <button type="button" onClick={() => setShowLeaveForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 13 }}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              )}

              {leaves.requests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 12, color: "#94a3b8", fontSize: 13 }}>{t("leave.none")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {leaves.requests.slice(0, 8).map((lr) => {
                    const st = LEAVE_STATUS_META[lr.status] || LEAVE_STATUS_META.PENDING;
                    return (
                      <div key={lr.id} style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9", fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>
                              {t(LEAVE_TYPES.find((x) => x.value === lr.type)?.key || "leave.annual")} — {lr.days} {t("leave.days")}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: 10 }}>
                              {new Date(lr.startDate).toLocaleDateString()} → {new Date(lr.endDate).toLocaleDateString()}
                            </div>
                            {lr.decisionNote && <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>💬 {lr.decisionNote}</div>}
                          </div>
                          <div style={{ textAlign: "end" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, color: st.color, background: st.bg, whiteSpace: "nowrap" }}>
                              {t(st.key)}
                            </span>
                            {lr.status === "PENDING" && (
                              <div>
                                <button onClick={() => cancelLeave(lr.id)} style={{ marginTop: 4, fontSize: 10, border: "none", background: "none", color: "#ef4444", cursor: "pointer", textDecoration: "underline" }}>
                                  {t("common.cancel")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Salary Card for Salarié */}
          {hr?.jobType !== "freelancer" && (
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
                <DollarSign size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
                {t("empDash.salaryPayments")}
              </h3>
              {hr?.salary > 0 ? (
                <>
                  <div
                    style={{
                      background: `${primary}11`,
                      borderRadius: 12,
                      padding: 16,
                      textAlign: "center",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 700, color: primary }}>
                      {(hr.salary || 0).toLocaleString()} {t("common.currency")}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {t("empDash.monthlySalary")}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      padding: "8px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>{t("empDash.paymentStatus")}</span>
                    <span style={{ color: hr?.isPaid ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                      {hr?.isPaid ? "✅ " + t("emp.paid") : "⏳ " + t("emp.pending")}
                    </span>
                  </div>

                  {hr?.paymentDate && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "8px 0",
                        color: "#64748b",
                      }}
                    >
                      <span>{t("empDash.paymentDate")}</span>
                      <span style={{ fontWeight: 500, color: "#1e293b" }}>{hr.paymentDate}</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
                  <DollarSign size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                  {t("empDash.noSalary")}
                </div>
              )}
            </div>
          )}

          {/* Commission Card for Freelancer */}
          {hr?.jobType === "freelancer" && (
            <div className="card">
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
                <TrendingUp size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
                {t("empDash.myCommissions")}
              </h3>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: t("empDash.totalShort"), value: totalCommission, color: "#f59e0b", bg: "#fef3c7" },
                  { label: t("emp.paid"), value: paidCommission, color: "#10b981", bg: "#d1fae5" },
                  { label: t("empDash.due"), value: unpaidCommission, color: "#3b82f6", bg: "#dbeafe" },
                ].map((s) => (
                  <div key={s.label} style={{
                    background: s.bg, borderRadius: 10,
                    padding: "10px 8px", textAlign: "center"
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                      {s.value.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 9, color: s.color, marginTop: 2, fontWeight: 600 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 9, color: s.color, opacity: 0.7 }}>{t("common.currency")}</div>
                  </div>
                ))}
              </div>

              {/* Rate */}
              {hr?.commissionRate > 0 && (
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 8, padding: "8px 12px",
                  fontSize: 12, color: "#92400e",
                  marginBottom: 14, textAlign: "center",
                  fontWeight: 600
                }}>
                  {t("empDash.yourRate")} {hr.commissionRate}%
                </div>
              )}

              {/* Payment Status */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: hr?.isPaid ? "#d1fae5" : "#fef3c7",
                marginBottom: 14
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: hr?.isPaid ? "#065f46" : "#92400e" }}>
                  {t("empDash.paymentStatus")}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: hr?.isPaid ? "#10b981" : "#f59e0b" }}>
                  {hr?.isPaid ? t("empDash.commissionsPaid") : t("empDash.awaitingPayment")}
                </span>
              </div>

              {/* Commission History */}
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "#475569" }}>
                {t("empDash.commissionLog")}
              </h4>
              {commissions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>
                  {t("empDash.noCommissions")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {commissions.map((c) => (
                    <div key={c.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px", borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      fontSize: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
                        <div style={{ color: "#94a3b8", fontSize: 10 }}>
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-DZ") : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 800, color: "#f59e0b", fontSize: 14 }}>
                          +{(c.commissionAmount || 0).toFixed(2)} {t("common.currency")}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {c.commissionType === "percent"
                            ? `${c.commissionValue}%`
                            : t("empDash.fixedAmount")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mes documents RH (téléchargement authentifié) */}
          {myDocs.length > 0 && (
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>📎 {t("empDash.myDocuments")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {myDocs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => apiDownload(`/employees/me/documents/${d.id}/download`, d.name).catch((err) => toast.error(err.message))}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9", cursor: "pointer", fontSize: 13, textAlign: "start", width: "100%" }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</span>
                    <span style={{ color: "#3b82f6", fontSize: 12, flexShrink: 0 }}>⬇️ {(d.size / 1024).toFixed(0)} Ko</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Performance Card */}
          <div className="card">
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
              <TrendingUp size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
              {t("empDash.myPerformance")}
            </h3>

            {totalTasks === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>
                {t("empDash.noPerfData")}
              </div>
            ) : (
              <>
                {/* Completion Rate Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: "#475569" }}>{t("empDash.completionRate")}</span>
                    <span style={{ color: "#10b981", fontWeight: 600 }}>{completionRate}%</span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 99, height: 10 }}>
                    <div
                      style={{
                        width: `${completionRate}%`,
                        height: 10,
                        borderRadius: 99,
                        background: completionRate >= 70 ? "#10b981" : completionRate >= 40 ? "#f59e0b" : "#ef4444",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Task Status Breakdown */}
                {[
                  { label: t("empDash.pendingStatus"), count: myTasks.filter((t) => t.status === "pending").length, color: "#6b7280" },
                  { label: t("empDash.inProgressStatus"), count: myTasks.filter((x) => x.status === "in_progress").length, color: "#3b82f6" },
                  { label: t("empDash.completedStatus"), count: doneCount, color: "#10b981" },
                ].map((bar) => {
                  const pct = totalTasks ? Math.round((bar.count / totalTasks) * 100) : 0;
                  return (
                    <div key={bar.label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#475569" }}>{bar.label}</span>
                        <span style={{ color: bar.color, fontWeight: 600 }}>{bar.count} ({pct}%)</span>
                      </div>
                      <div style={{ background: "#f1f5f9", borderRadius: 99, height: 8 }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: 8,
                            borderRadius: 99,
                            background: bar.color,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

              </>
            )}
          </div>

          {/* Agency Info */}
          <div className="card">
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{t("empDash.myAgency")}</h3>
            {[
              { label: t("common.name"), value: agency?.name },
              { label: t("common.phone"), value: agency?.phone },
              { label: t("common.email"), value: agency?.email },
              { label: t("common.address"), value: agency?.address },
            ]
              .filter((i) => i.value)
              .map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#64748b" }}>{item.label}</span>
                  <span
                    style={{
                      fontWeight: 500,
                      textAlign: "left",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
