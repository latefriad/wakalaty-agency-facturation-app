import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import { api } from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import UpgradeModal from "../components/UpgradeModal";
import {
  Plus, Trash2, Edit, Check, Clock, AlertCircle, Search, Filter, X,
  LayoutGrid, List as ListIcon, Calendar as CalendarIcon, ChevronRight, ChevronLeft,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, isSameMonth, isSameDay,
} from "date-fns";

// Libellés = clés i18n résolues par t() DANS le composant (jamais au niveau
// module, où t n'existe pas).
const STATUSES = {
  TODO: { key: "tasks.todo", color: "#6b7280", bg: "#f3f4f6" },
  INPROGRESS: { key: "tasks.inprogress", color: "var(--primary-color)", bg: "#dbeafe" },
  DONE: { key: "tasks.done", color: "var(--success)", bg: "#d1fae5" },
};
const STATUS_ORDER = ["TODO", "INPROGRESS", "DONE"];

const PRIORITIES = {
  HIGH: { key: "tasks.high", color: "var(--danger)", bg: "#fee2e2" },
  MEDIUM: { key: "tasks.medium", color: "var(--warning)", bg: "#fef3c7" },
  LOW: { key: "tasks.low", color: "var(--success)", bg: "#d1fae5" },
};
const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"];

const TASK_TYPES = [
  { value: "DAILY", key: "tasks.daily", icon: "📅" },
  { value: "WEEKLY", key: "tasks.weekly", icon: "📆" },
  { value: "PROJECT", key: "tasks.project", icon: "🗂️" },
];

const VIEWS = [
  { value: "kanban", key: "tasks.viewKanban", icon: LayoutGrid },
  { value: "list", key: "tasks.viewList", icon: ListIcon },
  { value: "calendar", key: "tasks.viewCalendar", icon: CalendarIcon },
];

const emptyForm = {
  title: "",
  description: "",
  type: "DAILY",
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
  employeeId: "",
  clientId: "",
  status: "TODO",
};

export default function Tasks() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const { canAdd, getLimit } = useSubscription();
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();

  // ?client=<id> : arrivée depuis la fiche client — filtre appliqué côté
  // serveur pour rester exact même au-delà de la limite de chargement.
  const clientFilter = new URLSearchParams(location.search).get("client") || "";

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban");
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const dragTaskId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      // Liste allégée accessible à tous les rôles (l'ancienne route
      // /employees renvoyait 403 aux non-admins).
      const res = await api.get("/employees/assignable");
      setEmployees(res.data || []);
    } catch {
      toast.error(t("tasks.loadEmployeesError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get("/clients", { limit: 100 });
      setClients(res.data || []);
    } catch {
      // Silencieux : le sélecteur client est un confort, pas un bloquant.
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const params = { limit: 500 };
      if (clientFilter) params.clientId = clientFilter;
      const res = await api.get("/tasks", params);
      setTasks(res.data || []);
    } catch {
      toast.error(t("tasks.loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientFilter]);

  useEffect(() => {
    fetchEmployees();
    fetchClients();
  }, [fetchEmployees, fetchClients]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === clientFilter) || tasks.find((x) => x.client?.id === clientFilter)?.client,
    [clients, tasks, clientFilter]
  );

  // Un seul état filtré : Kanban, liste et calendrier restent synchronisés.
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${task.title} ${task.description || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterEmployee !== "all" && task.employeeId !== filterEmployee) return false;
      if (overdueOnly && !task.isOverdue) return false;
      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus, filterEmployee, overdueOnly]);

  const groupedByStatus = useMemo(() => {
    const groups = {};
    for (const s of STATUS_ORDER) groups[s] = [];
    for (const task of filteredTasks) {
      if (groups[task.status]) groups[task.status].push(task);
    }
    return groups;
  }, [filteredTasks]);

  const stats = useMemo(() => ({
    TODO: tasks.filter((x) => x.status === "TODO").length,
    INPROGRESS: tasks.filter((x) => x.status === "INPROGRESS").length,
    DONE: tasks.filter((x) => x.status === "DONE").length,
    OVERDUE: tasks.filter((x) => x.isOverdue).length,
  }), [tasks]);

  const employeeProgress = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    for (const task of tasks) {
      if (!task.employeeId) continue;
      const key = task.employeeId;
      if (!map.has(key)) {
        map.set(key, { employeeId: key, name: task.employee?.name || "?", total: 0, done: 0 });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (task.status === "DONE") entry.done += 1;
    }
    return Array.from(map.values());
  }, [tasks, isAdmin]);

  // ── Actions ──────────────────────────────────────────────

  const openAddModal = () => {
    setEditingTask(null);
    setForm({ ...emptyForm, clientId: clientFilter || "" });
    setShowModal(true);
  };

  const openEditModal = (task) => {
    if (!isAdmin) return;
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      type: task.type || "DAILY",
      priority: task.priority || "MEDIUM",
      startDate: task.startDate ? task.startDate.split("T")[0] : "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      employeeId: task.employeeId || "",
      clientId: task.clientId || "",
      status: task.status || "TODO",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error(t("tasks.titleRequired"));

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        type: form.type,
        priority: form.priority,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        employeeId: form.employeeId || null,
        clientId: form.clientId || null,
      };

      if (editingTask) {
        payload.status = form.status;
        await api.patch(`/tasks/${editingTask.id}`, payload);
        toast.success(t("tasks.updated"));
      } else {
        if (!canAdd("tasks", tasks.length)) {
          setShowUpgrade(true);
          setSaving(false);
          return;
        }
        await api.post("/tasks", payload);
        toast.success(t("tasks.created"));
      }
      setShowModal(false);
      setEditingTask(null);
      setForm(emptyForm);
      await fetchTasks();
    } catch (err) {
      toast.error(err.message || t("tasks.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Mise à jour optimiste : la carte bouge tout de suite, rollback par
  // re-fetch si le serveur refuse (ex. carte d'un collègue).
  const moveTask = async (taskId, newStatus) => {
    const task = tasks.find((x) => x.id === taskId);
    if (!task || task.status === newStatus) return;
    const newOrder = (groupedByStatus[newStatus] || []).length;
    setTasks((prev) =>
      prev.map((x) =>
        x.id === taskId
          ? { ...x, status: newStatus, order: newOrder, isOverdue: newStatus === "DONE" ? false : x.isOverdue }
          : x
      )
    );
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus, order: newOrder });
      toast.success(t("tasks.statusUpdated"));
    } catch (err) {
      toast.error(err.message || t("tasks.updateError"));
      await fetchTasks();
    }
  };

  const handleDelete = async (taskId) => {
    if (!(await confirm(t("tasks.deleteConfirm")))) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success(t("tasks.deleted"));
      await fetchTasks();
    } catch (err) {
      toast.error(err.message || t("tasks.deleteError"));
    }
  };

  const clearClientFilter = () => navigate("/tasks", { replace: true });

  // ── Rendu ────────────────────────────────────────────────

  const chip = (label, color, bg, extra = {}) => (
    <span
      style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 999,
        color, background: bg, fontWeight: 800, whiteSpace: "nowrap", ...extra,
      }}
    >
      {label}
    </span>
  );

  const renderTaskCard = (task) => {
    const st = STATUSES[task.status] || STATUSES.TODO;
    const pr = PRIORITIES[task.priority] || PRIORITIES.MEDIUM;
    const type = TASK_TYPES.find((x) => x.value === task.type);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => {
          dragTaskId.current = task.id;
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          dragTaskId.current = null;
          setDragOverCol(null);
        }}
        onDoubleClick={() => openEditModal(task)}
        className="card"
        style={{
          borderRight: `4px solid ${task.isOverdue ? "#ef4444" : st.color}`,
          marginBottom: 10, cursor: "grab",
        }}
      >
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontWeight: 900, fontSize: 14 }}>{task.title}</span>
                {chip(t(pr.key), pr.color, pr.bg)}
                {task.isOverdue && chip(`⚠️ ${t("tasks.late")}`, "#ef4444", "#fee2e2")}
                {type && chip(`${type.icon} ${t(type.key)}`, "#64748b", "#f1f5f9")}
              </div>
              {task.description && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  {task.description}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {task.employee?.name && chip(`👤 ${task.employee.name}`, "#6d28d9", "#ede9fe")}
                {task.client?.name && chip(`🏢 ${task.client.name}`, "#0369a1", "#e0f2fe")}
                {(task.startDate || task.dueDate) && (
                  <span style={{ fontSize: 11, color: task.isOverdue ? "#ef4444" : "var(--text-muted)", fontWeight: 700 }}>
                    📅 {task.startDate ? format(new Date(task.startDate), "dd/MM") + " → " : ""}
                    {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : ""}
                  </span>
                )}
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => openEditModal(task)}
                  style={{
                    padding: 6, borderRadius: 8, border: "1px solid var(--border-color)",
                    background: "var(--bg-card)", cursor: "pointer", color: "var(--primary-color)",
                  }}
                  title={t("tasks.modify")}
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  style={{
                    padding: 6, borderRadius: 8, border: "1px solid #fca5a5",
                    background: "var(--bg-card)", cursor: "pointer", color: "var(--danger)",
                  }}
                  title={t("common.delete")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Repli sans drag (mobile / clavier). Un employé ne voit que ses
              tâches et le serveur ne lui autorise que le statut. */}
          <select
            value={task.status}
            onChange={(e) => moveTask(task.id, e.target.value)}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 8,
              border: `1px solid ${st.color}`, fontSize: 11, color: st.color,
              fontWeight: 800, outline: "none", cursor: "pointer", background: "var(--bg-card)",
              marginTop: 8,
            }}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{t(STATUSES[s].key)}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderKanban = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, direction: "inherit" }}>
      {STATUS_ORDER.map((col) => {
        const meta = STATUSES[col];
        const colTasks = groupedByStatus[col] || [];
        const isOver = dragOverCol === col;
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverCol !== col) setDragOverCol(col);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCol(null);
              if (dragTaskId.current) moveTask(dragTaskId.current, col);
            }}
            style={{
              minWidth: 0, borderRadius: 12, padding: 4,
              background: isOver ? `${meta.color}14` : "transparent",
              outline: isOver ? `2px dashed ${meta.color}` : "none",
              transition: "background 0.15s ease",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              paddingBottom: 8, borderBottom: `3px solid ${meta.color}`,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color }} />
              <span style={{ fontWeight: 900, fontSize: 14, color: meta.color }}>{t(meta.key)}</span>
              {chip(colTasks.length, meta.color, meta.bg, { fontSize: 11 })}
            </div>
            <div style={{ minHeight: 60 }}>
              {colTasks.length === 0 && (
                <div style={{
                  textAlign: "center", padding: 24, color: "var(--border-color)",
                  border: "2px dashed var(--border-color)", borderRadius: 10, fontSize: 12,
                }}>
                  {t("tasks.empty")}
                </div>
              )}
              {colTasks.map(renderTaskCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderList = () => (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "start", color: "var(--text-muted)", fontSize: 11 }}>
            {[t("tasks.taskTitle"), t("tasks.client"), t("tasks.employee"), t("tasks.priority"), t("common.status"), t("tasks.startDate"), t("tasks.deadline"), t("common.actions")].map((h) => (
              <th key={h} style={{ padding: "10px 12px", borderBottom: "2px solid var(--border-color)", textAlign: "start", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map((task) => {
            const st = STATUSES[task.status] || STATUSES.TODO;
            const pr = PRIORITIES[task.priority] || PRIORITIES.MEDIUM;
            return (
              <tr key={task.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                  {task.title}
                  {task.isOverdue && <span style={{ marginInlineStart: 6 }}>{chip(`⚠️ ${t("tasks.late")}`, "#ef4444", "#fee2e2")}</span>}
                </td>
                <td style={{ padding: "10px 12px", color: "#0369a1" }}>{task.client?.name || "—"}</td>
                <td style={{ padding: "10px 12px", color: "#6d28d9" }}>{task.employee?.name || t("tasks.unassigned")}</td>
                <td style={{ padding: "10px 12px" }}>{chip(t(pr.key), pr.color, pr.bg)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <select
                    value={task.status}
                    onChange={(e) => moveTask(task.id, e.target.value)}
                    style={{
                      padding: "4px 8px", borderRadius: 8, border: `1px solid ${st.color}`,
                      fontSize: 11, color: st.color, fontWeight: 800, cursor: "pointer", background: "var(--bg-card)",
                    }}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{t(STATUSES[s].key)}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {task.startDate ? format(new Date(task.startDate), "dd/MM/yyyy") : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: task.isOverdue ? "#ef4444" : "var(--text-muted)", fontWeight: task.isOverdue ? 800 : 400, whiteSpace: "nowrap" }}>
                  {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditModal(task)} style={{ padding: 5, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer", color: "var(--primary-color)" }}>
                        <Edit size={13} />
                      </button>
                      <button onClick={() => handleDelete(task.id)} style={{ padding: 5, borderRadius: 6, border: "1px solid #fca5a5", background: "var(--bg-card)", cursor: "pointer", color: "var(--danger)" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filteredTasks.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>{t("tasks.empty")}</div>
      )}
    </div>
  );

  const renderCalendar = () => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });

    const days = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

    const tasksByDay = (day) =>
      filteredTasks.filter((x) => x.dueDate && isSameDay(new Date(x.dueDate), day));

    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={() => setCalendarMonth((m) => addMonths(m, -1))} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 16 }}>{format(calendarMonth, "MM/yyyy")}</span>
            <button
              onClick={() => setCalendarMonth(new Date())}
              style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-app)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              {t("tasks.today")}
            </button>
          </div>
          <button onClick={() => setCalendarMonth((m) => addMonths(m, 1))} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {days.slice(0, 7).map((d) => (
            <div key={`h-${d}`} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", padding: 4 }}>
              {format(d, "EEE")}
            </div>
          ))}
          {days.map((day) => {
            const dayTasks = tasksByDay(day);
            const inMonth = isSameMonth(day, calendarMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                style={{
                  minHeight: 84, borderRadius: 8, padding: 4,
                  background: inMonth ? "#fff" : "var(--bg-app)",
                  border: isToday ? "2px solid #3b82f6" : "1px solid #f1f5f9",
                  opacity: inMonth ? 1 : 0.55,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: isToday ? "#3b82f6" : "var(--text-muted)", marginBottom: 3 }}>
                  {format(day, "d")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayTasks.slice(0, 3).map((task) => {
                    const st = STATUSES[task.status] || STATUSES.TODO;
                    return (
                      <div
                        key={task.id}
                        onClick={() => openEditModal(task)}
                        title={task.title}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
                          background: task.isOverdue ? "#fee2e2" : st.bg,
                          color: task.isOverdue ? "#ef4444" : st.color,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: isAdmin ? "pointer" : "default",
                        }}
                      >
                        {task.title}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>+{dayTasks.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("tasks.title")}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 14 }}>
            {tasks.length} {t("tasks.totalCount")}
          </p>
        </div>
        {isAdmin && (
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={16} style={{ marginLeft: 4 }} /> {t("tasks.addTask")}
          </button>
        )}
      </div>

      {clientFilter && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
          padding: "10px 14px", background: "#e0f2fe", borderRadius: 10,
          color: "#0369a1", fontWeight: 700, fontSize: 13,
        }}>
          🏢 {t("tasks.clientTasks")} : {activeClient?.name || clientFilter}
          <button
            onClick={clearClientFilter}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#0369a1", display: "flex" }}
            title={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {STATUS_ORDER.map((s) => (
          <div key={s} className="card" style={{ textAlign: "center", background: STATUSES[s].bg, border: "none" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: STATUSES[s].color }}>{stats[s]}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{t(STATUSES[s].key)}</div>
          </div>
        ))}
        <div
          className="card"
          onClick={() => setOverdueOnly((v) => !v)}
          style={{
            textAlign: "center", background: "#fee2e2", cursor: "pointer",
            border: overdueOnly ? "2px solid #ef4444" : "none",
          }}
          title={t("tasks.overdueOnly")}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--danger)" }}>{stats.OVERDUE}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>⚠️ {t("tasks.late")}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-hover)", borderRadius: 10, padding: 3 }}>
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.value;
            return (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6,
                  background: active ? "#fff" : "transparent",
                  color: active ? "#1e293b" : "var(--text-muted)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <Icon size={14} /> {t(v.key)}
              </button>
            );
          })}
        </div>

        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={16} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("tasks.searchPlaceholder")}
            style={{
              width: "100%", padding: "9px 36px 9px 12px", borderRadius: 10,
              border: "1px solid var(--border-color)", fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border-color)",
            background: showFilters ? "#1e293b" : "var(--bg-card)", color: showFilters ? "#fff" : "var(--text-muted)",
            cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <Filter size={14} /> {t("tasks.filters")}
        </button>
      </div>

      {showFilters && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20, padding: 12, background: "var(--bg-app)", borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>{t("tasks.priority")} :</span>
            {["all", ...PRIORITY_ORDER].map((v) => (
              <button
                key={v}
                onClick={() => setFilterPriority(v)}
                style={{
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: filterPriority === v ? "#3b82f6" : "var(--bg-card)",
                  color: filterPriority === v ? "#fff" : "var(--text-muted)",
                  border: filterPriority === v ? "none" : "1px solid #e2e8f0",
                }}
              >
                {v === "all" ? t("tasks.allF") : t(PRIORITIES[v].key)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>{t("common.status")} :</span>
            {["all", ...STATUS_ORDER].map((v) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                style={{
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: filterStatus === v ? "#1e293b" : "var(--bg-card)",
                  color: filterStatus === v ? "#fff" : "var(--text-muted)",
                  border: filterStatus === v ? "none" : "1px solid #e2e8f0",
                }}
              >
                {v === "all" ? t("common.all") : t(STATUSES[v].key)}
              </button>
            ))}
          </div>
          {isAdmin && employees.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>{t("tasks.employee")} :</span>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, background: "var(--bg-card)", cursor: "pointer" }}
              >
                <option value="all">{t("common.all")}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <Clock size={24} style={{ marginBottom: 8, animation: "spin 1s linear infinite" }} />
          <div>{t("common.loading")}</div>
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <AlertCircle size={48} style={{ marginBottom: 12 }} />
          <div>{t("tasks.empty")}</div>
        </div>
      )}

      {!loading && isAdmin && employeeProgress.length > 0 && view !== "calendar" && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{t("tasks.employeeProgress")}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {employeeProgress.map((g) => {
              const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
              return (
                <div
                  key={g.employeeId}
                  className="card"
                  style={{
                    padding: "10px 12px", minWidth: 230, background: "var(--bg-card)",
                    border: "1px solid var(--border-color)", borderRight: "4px solid #10b981",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>👤 {g.name}</div>
                    <div style={{ fontWeight: 800, color: "var(--success)", fontSize: 13 }}>{pct}%</div>
                  </div>
                  <div style={{ height: 10, background: "var(--bg-hover)", borderRadius: 999, marginTop: 10 }}>
                    <div style={{
                      width: `${pct}%`, height: 10, borderRadius: 999,
                      background: "var(--success)", transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    {t("tasks.done")} : {g.done} / {g.total}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <>
          {view === "kanban" && renderKanban()}
          {view === "list" && renderList()}
          {view === "calendar" && renderCalendar()}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {editingTask ? t("tasks.editTask") : t("tasks.newTask")}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <label className="form-label">{t("tasks.taskTitle")} *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("tasks.taskTitle")}
              className="form-input"
              style={{ marginBottom: 14 }}
            />

            <label className="form-label">{t("tasks.description")}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="form-input"
              style={{ resize: "none", marginBottom: 14 }}
            />

            <label className="form-label">{t("tasks.type")}</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {TASK_TYPES.map((tt) => (
                <button
                  key={tt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: tt.value }))}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13,
                    background: form.type === tt.value ? "#3b82f6" : "var(--bg-hover)",
                    color: form.type === tt.value ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {tt.icon} {t(tt.key)}
                </button>
              ))}
            </div>

            <label className="form-label">{t("tasks.priority")}</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: form.priority === p ? PRIORITIES[p].color : "var(--bg-hover)",
                    color: form.priority === p ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {t(PRIORITIES[p].key)}
                </button>
              ))}
            </div>

            {editingTask && (
              <>
                <label className="form-label">{t("common.status")}</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        background: form.status === s ? STATUSES[s].color : "var(--bg-hover)",
                        color: form.status === s ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {t(STATUSES[s].key)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t("tasks.startDate")}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="form-input"
                  style={{ marginBottom: 14 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t("tasks.deadline")}</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="form-input"
                  style={{ marginBottom: 14 }}
                />
              </div>
            </div>

            <label className="form-label">{t("tasks.client")}</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="form-input"
              style={{ marginBottom: 14, cursor: "pointer" }}
            >
              <option value="">{t("tasks.noClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
              ))}
            </select>

            <label className="form-label">{t("tasks.employee")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, employeeId: "" }))}
                style={{
                  padding: "6px 12px", borderRadius: 20, border: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 800,
                  background: !form.employeeId ? "#334155" : "var(--bg-hover)",
                  color: !form.employeeId ? "#fff" : "var(--text-muted)",
                }}
              >
                {t("tasks.unassigned")}
              </button>
              {employees.map((emp) => {
                const selected = form.employeeId === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, employeeId: emp.id }))}
                    style={{
                      padding: "6px 12px", borderRadius: 20, border: "none",
                      cursor: "pointer", fontSize: 12, fontWeight: 800,
                      background: selected ? "#6d28d9" : "var(--bg-hover)",
                      color: selected ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {selected ? "✓ " : ""}{emp.name}
                  </button>
                );
              })}
              {employees.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("tasks.noEmployee")}</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
                style={{ flex: 2, padding: "12px 0", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {saving ? t("common.saving") : (
                  <>
                    <Check size={16} /> {editingTask ? t("tasks.modify") : t("tasks.create")}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  background: "var(--bg-hover)", border: "none", cursor: "pointer", fontSize: 14,
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
          resource="tasks"
          limit={getLimit("tasks")}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
