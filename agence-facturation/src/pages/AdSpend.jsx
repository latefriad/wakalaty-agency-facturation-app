import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { useConfirm } from "../components/ConfirmProvider";
import toast from "react-hot-toast";
import { api } from "../services/api";
import {
  getAdSpend,
  getAdSpendSummary,
  createAdSpend,
  updateAdSpend,
  deleteAdSpend,
  exportAdSpendExcel,
} from "../services/adSpendService";

const PLATFORMS = [
  { id: "META", key: "platform.META", icon: "🌐", color: "#1877F2", bg: "#e7f3ff" },
  { id: "TIKTOK", key: "platform.TIKTOK", icon: "🎵", color: "#000000", bg: "var(--bg-hover)" },
  { id: "GOOGLE", key: "platform.GOOGLE", icon: "🔍", color: "#EA4335", bg: "rgba(239, 68, 68, 0.1)" },
  { id: "OTHER", key: "platform.OTHER", icon: "📢", color: "var(--text-main)", bg: "var(--bg-app)" },
];

function currentMonthStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

const emptyForm = {
  clientId: "",
  month: currentMonthStr(),
  platform: "META",
  campaignName: "",
  clientAdBudget: "",
  actualSpend: "",
  amountBilled: "",
  orders: "",
  revenueGenerated: "",
  notes: "",
};

export default function AdSpend() {
  const { profile, agency } = useAuth();
  const { t } = useLang();
  const confirm = useConfirm();

  // Filters
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [search, setSearch] = useState("");

  // Data
  const [entries, setEntries] = useState([]);
  const [summaryData, setSummaryData] = useState({
    totalSpend: 0,
    totalBilled: 0,
    totalMargin: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgROAS: 0,
    avgCPA: 0,
  });
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const agencyCurrency = agency?.currency || "DZD";

  // Role validation
  const userRole = profile?.role || "EMPLOYEE";
  const canAccess = ["ADMIN", "ACCOUNTANT", "ADS"].includes(userRole);

  // Fetch clients for dropdown filter & form
  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get("/clients", { limit: 100 });
      setClients(res.data || []);
    } catch {
      // Fallback
    }
  }, []);

  // Fetch entries and summaries
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        month: selectedMonth || undefined,
        clientId: selectedClient || undefined,
        platform: selectedPlatform || undefined,
        search: search || undefined,
      };

      const [listRes, sumRes] = await Promise.all([
        getAdSpend(params),
        getAdSpendSummary(params),
      ]);

      setEntries(listRes.data || []);
      if (listRes.summary) {
        setSummaryData(listRes.summary);
      }
      setMonthlyChart(sumRes.monthSeries || []);
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedClient, selectedPlatform, search, t]);

  useEffect(() => {
    if (canAccess) {
      fetchClients();
    }
  }, [canAccess, fetchClients]);

  useEffect(() => {
    if (canAccess) {
      fetchData();
    }
  }, [canAccess, fetchData]);

  // Handle Export Excel
  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAdSpendExcel({
        month: selectedMonth || undefined,
        clientId: selectedClient || undefined,
        platform: selectedPlatform || undefined,
      });
      toast.success(t("adspend.exportExcel") + " ✓");
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setExporting(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingEntry(null);
    setForm({
      ...emptyForm,
      month: selectedMonth || currentMonthStr(),
      clientId: selectedClient || (clients[0]?.id || ""),
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      clientId: entry.clientId || "",
      month: entry.month || currentMonthStr(),
      platform: entry.platform || "META",
      campaignName: entry.campaignName || "",
      clientAdBudget: entry.clientAdBudget ? String(entry.clientAdBudget) : "",
      actualSpend: entry.actualSpend ? String(entry.actualSpend) : "",
      amountBilled: entry.amountBilled ? String(entry.amountBilled) : "",
      orders: entry.orders ? String(entry.orders) : "",
      revenueGenerated: entry.revenueGenerated ? String(entry.revenueGenerated) : "",
      notes: entry.notes || "",
    });
    setShowModal(true);
  };

  // Handle Submit Create / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientId) {
      toast.error(t("adspend.client") + " *");
      return;
    }
    if (!form.month) {
      toast.error(t("adspend.filterMonth") + " *");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clientId: form.clientId,
        month: form.month,
        platform: form.platform,
        campaignName: form.campaignName.trim(),
        clientAdBudget: form.clientAdBudget !== "" ? Number(form.clientAdBudget) : 0,
        actualSpend: form.actualSpend !== "" ? Number(form.actualSpend) : 0,
        amountBilled: form.amountBilled !== "" ? Number(form.amountBilled) : 0,
        orders: form.orders !== "" ? parseInt(form.orders, 10) : 0,
        revenueGenerated: form.revenueGenerated !== "" ? Number(form.revenueGenerated) : 0,
        notes: form.notes ? form.notes.trim() : null,
      };

      if (editingEntry) {
        await updateAdSpend(editingEntry.id, payload);
        toast.success(t("adspend.updated"));
      } else {
        await createAdSpend(payload);
        toast.success(t("adspend.created"));
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Entry
  const handleDelete = async (id) => {
    const ok = await confirm(t("adspend.deleteConfirm"));
    if (!ok) return;

    try {
      await deleteAdSpend(id);
      toast.success(t("adspend.deleted"));
      fetchData();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  // ── TRANSFER TO INVOICE + EXPENSE ──────────────────────────────────
  // 1. Creates a FACTURE for the client (amountBilled)
  // 2. Creates an internal Expense entry (actualSpend → category ADS)
  const [billingEntryId, setBillingEntryId] = useState(null); // loading state per row

  const handleBillToInvoice = async (entry) => {
    const clientName = clients.find((c) => c.id === entry.clientId)?.name || "Client";
    const platform = entry.platform || "ADS";
    const month = entry.month || currentMonthStr();
    const campaign = entry.campaignName ? ` – ${entry.campaignName}` : "";
    const label = `${platform}${campaign} (${month})`;
    const billed = Number(entry.amountBilled || 0);
    const spent = Number(entry.actualSpend || 0);

    if (billed <= 0) {
      toast.error("Le montant facturé (Montant facturé) doit être > 0 pour créer une facture.");
      return;
    }

    const ok = await confirm(
      `Facturer ${billed.toLocaleString("fr-DZ")} ${agencyCurrency} à ${clientName} ` +
      `et enregistrer ${spent.toLocaleString("fr-DZ")} ${agencyCurrency} comme dépense réelle ?`
    );
    if (!ok) return;

    setBillingEntryId(entry.id);
    try {
      const promises = [];

      // 1️⃣ Create invoice (FACTURE) for the client
      if (billed > 0) {
        promises.push(
          api.post("/invoices", {
            clientId: entry.clientId,
            docType: "FACTURE",
            status: "EN_ATTENTE",
            items: [
              {
                description: `Frais Media Buying – ${label}`,
                quantity: 1,
                unitPrice: billed,
                tax: 0,
              },
            ],
            notes: `Généré automatiquement depuis Suivi des Dépenses Ads — ${label}`,
            dueDate: null,
          })
        );
      }

      // 2️⃣ Create expense (Dépense réelle) in expenses section
      if (spent > 0) {
        promises.push(
          api.post("/expenses", {
            description: `Dépense Ads réelle – ${label} (${clientName})`,
            amount: spent,
            category: "ADS",
            date: new Date(`${month}-01`).toISOString(),
            notes: `Transféré depuis Suivi des Dépenses Ads — ${label}`,
          })
        );
      }

      await Promise.all(promises);

      toast.success(
        `✅ Facture créée (${billed.toLocaleString("fr-DZ")} ${agencyCurrency}) + Dépense enregistrée (${spent.toLocaleString("fr-DZ")} ${agencyCurrency}) !`
      );
    } catch (err) {
      toast.error(err.message || t("common.error"));
    } finally {
      setBillingEntryId(null);
    }
  };


  // ROAS Badge Helper
  const renderROASBadge = (roas) => {
    let color = "#dc2626";
    let bg = "#fef2f2";
    let border = "#fecaca";
    let label = t("adspend.roasBad");

    if (roas >= 3.0) {
      color = "#059669";
      bg = "#ecfdf5";
      border = "#a7f3d0";
      label = t("adspend.roasGood");
    } else if (roas >= 1.5) {
      color = "#d97706";
      bg = "#fffbeb";
      border = "#fde68a";
      label = t("adspend.roasMedium");
    }

    return (
      <span
        title={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 6,
          background: bg,
          color,
          border: `1px solid ${border}`,
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        <span>{roas > 0 ? `${roas}x` : "—"}</span>
      </span>
    );
  };

  // Live modal computations
  const modalActualSpend = Number(form.actualSpend || 0);
  const modalRevenue = Number(form.revenueGenerated || 0);
  const modalBilled = Number(form.amountBilled || 0);
  const modalOrders = Number(form.orders || 0);
  const modalROAS = modalActualSpend > 0 ? (modalRevenue / modalActualSpend).toFixed(2) : "0.00";
  const modalCPA = modalOrders > 0 ? (modalActualSpend / modalOrders).toFixed(2) : "0.00";
  const modalMargin = (modalBilled - modalActualSpend).toFixed(2);

  // Chart max calculation
  const maxChartVal = useMemo(() => {
    let m = 1;
    monthlyChart.forEach((row) => {
      if (row.spend > m) m = row.spend;
      if (row.revenue > m) m = row.revenue;
    });
    return m;
  }, [monthlyChart]);

  if (!canAccess) {
    return (
      <div style={{ padding: 32, textAlign: "center", direction: "inherit" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2>{t("common.error")}</h2>
        <p style={{ color: "var(--text-muted)" }}>Accès restreint aux rôles ADMIN, ACCOUNTANT, ADS.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", direction: "inherit", maxWidth: 1600, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📊</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text-main)" }}>
              {t("adspend.title")}
            </h1>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {t("adspend.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-main)",
              fontSize: 13,
              fontWeight: 700,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            <span>{exporting ? "⏳" : "📊"}</span>
            <span>{t("adspend.exportExcel")}</span>
          </button>

          {/* New Entry Button */}
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--primary-color)",
              color: "var(--bg-card)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
            }}
          >
            <span>{t("adspend.newEntry")}</span>
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Spend */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            💸
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("adspend.totalSpend")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
              {summaryData.totalSpend.toLocaleString("fr-DZ")} {agencyCurrency}
            </div>
          </div>
        </div>

        {/* Total Billed */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#eff6ff",
              color: "var(--primary-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🧾
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("adspend.totalBilled")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
              {summaryData.totalBilled.toLocaleString("fr-DZ")} {agencyCurrency}
            </div>
          </div>
        </div>

        {/* Total Margin */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            📈
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("adspend.totalMargin")}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: summaryData.totalMargin >= 0 ? "#059669" : "var(--danger)",
              }}
            >
              {summaryData.totalMargin.toLocaleString("fr-DZ")} {agencyCurrency}
            </div>
          </div>
        </div>

        {/* Avg ROAS */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fef3c7",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("adspend.avgROAS")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
              {summaryData.avgROAS > 0 ? `${summaryData.avgROAS}x` : "—"}
            </div>
          </div>
        </div>

        {/* Avg CPA */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#f3e8ff",
              color: "#9333ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            📦
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("adspend.avgCPA")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
              {summaryData.avgCPA > 0 ? `${summaryData.avgCPA.toLocaleString("fr-DZ")} ${agencyCurrency}` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Monthly Trend Chart (Spend vs Revenue) ── */}
      {monthlyChart.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            padding: 24,
            border: "1px solid var(--border-color)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                {t("adspend.chartTitle")}
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {monthlyChart.length} mois enregistrés
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--danger)" }} />
                <span>{t("adspend.chartSpend")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--success)" }} />
                <span>{t("adspend.chartRevenue")}</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              height: 160,
              paddingTop: 10,
              overflowX: "auto",
            }}
          >
            {monthlyChart.map((m) => {
              const spendHeight = Math.max(6, (m.spend / maxChartVal) * 125);
              const revenueHeight = Math.max(6, (m.revenue / maxChartVal) * 125);

              return (
                <div
                  key={m.month}
                  title={`${m.month} | Dépense: ${m.spend.toLocaleString("fr-DZ")} ${agencyCurrency} | Revenu: ${m.revenue.toLocaleString("fr-DZ")} ${agencyCurrency} | ROAS: ${m.roas}x`}
                  style={{
                    flex: "1 1 60px",
                    minWidth: 50,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {/* Bars side-by-side */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 125 }}>
                    <div
                      style={{
                        width: 16,
                        height: `${spendHeight}px`,
                        background: "var(--danger)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                    <div
                      style={{
                        width: 16,
                        height: `${revenueHeight}px`,
                        background: "var(--success)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Month Label & ROAS tag */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-main)" }}>
                      {m.month.slice(2)}
                    </div>
                    {m.roas > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 800, color: m.roas >= 3 ? "#059669" : "var(--warning)" }}>
                        {m.roas}x
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters Toolbar ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          padding: "12px 18px",
          border: "1px solid var(--border-color)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Month Picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("adspend.filterMonth")}:
          </span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
            }}
          />
          {selectedMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth("")}
              style={{
                border: "none",
                background: "var(--bg-hover)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 11,
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              ✕ {t("adspend.allMonths")}
            </button>
          )}
        </div>

        {/* Client Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("adspend.filterClient")}:
          </span>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
            }}
          >
            <option value="">{t("adspend.allClients")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Platform Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("adspend.filterPlatform")}:
          </span>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
            }}
          >
            <option value="">{t("adspend.allPlatforms")}</option>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {t(p.key)}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ flex: "1 1 180px" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالحملة أو العميل..."
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ── Table View (.table-wrapper) ── */}
      <div className="table-wrapper" style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border-color)", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            ⏳ {t("common.loading") || "Chargement..."}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div>{t("adspend.noData")}</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)", textAlign: "inherit" }}>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.filterMonth")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.client")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.filterPlatform")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.campaign")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.budget")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.spend")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.billed")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.orders")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.revenue")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.roas")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.cpa")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("adspend.margin")}</th>
                <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => {
                const pMeta = PLATFORMS.find((p) => p.id === item.platform) || PLATFORMS[0];

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {/* Month */}
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>
                      {item.month}
                    </td>

                    {/* Client */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {item.client?.name || "Client"}
                      </div>
                      {item.client?.company && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.client.company}</div>
                      )}
                    </td>

                    {/* Platform */}
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: pMeta.bg,
                          color: pMeta.color,
                        }}
                      >
                        {pMeta.icon} {item.platform}
                      </span>
                    </td>

                    {/* Campaign */}
                    <td style={{ padding: "12px 14px", color: "var(--text-main)" }}>
                      {item.campaignName || "—"}
                    </td>

                    {/* Client Budget */}
                    <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                      {item.clientAdBudget > 0
                        ? `${item.clientAdBudget.toLocaleString("fr-DZ")} ${agencyCurrency}`
                        : "—"}
                    </td>

                    {/* Actual Spend */}
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--danger)" }}>
                      {item.actualSpend.toLocaleString("fr-DZ")} {agencyCurrency}
                    </td>

                    {/* Amount Billed */}
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--primary-color)" }}>
                      {item.amountBilled.toLocaleString("fr-DZ")} {agencyCurrency}
                    </td>

                    {/* Orders */}
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>
                      {item.orders}
                    </td>

                    {/* Revenue */}
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--success)" }}>
                      {item.revenueGenerated > 0
                        ? `${item.revenueGenerated.toLocaleString("fr-DZ")} ${agencyCurrency}`
                        : "—"}
                    </td>

                    {/* ROAS Badge */}
                    <td style={{ padding: "12px 14px" }}>
                      {renderROASBadge(item.roas)}
                    </td>

                    {/* CPA */}
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-main)" }}>
                      {item.cpa > 0 ? `${item.cpa.toLocaleString("fr-DZ")} ${agencyCurrency}` : "—"}
                    </td>

                    {/* Agency Margin */}
                    <td
                      style={{
                        padding: "12px 14px",
                        fontWeight: 800,
                        color: item.agencyMargin >= 0 ? "#059669" : "var(--danger)",
                      }}
                    >
                      {item.agencyMargin.toLocaleString("fr-DZ")} {agencyCurrency}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title={t("common.edit")}
                          style={{
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-card)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          ✏️
                        </button>
                        {/* ── Transfer to Invoice + Expense ── */}
                        <button
                          type="button"
                          onClick={() => handleBillToInvoice(item)}
                          disabled={billingEntryId === item.id}
                          title="Transférer vers Facture + Dépense"
                          style={{
                            border: "1px solid #bbf7d0",
                            background: billingEntryId === item.id ? "#f0fdf4" : "#dcfce7",
                            color: "#15803d",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: billingEntryId === item.id ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {billingEntryId === item.id ? "⏳" : "🧾 Facturer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          title={t("common.delete")}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fff5f5",
                            color: "var(--danger)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          🗑️
                        </button>
                      </div>

                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 620,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxSizing: "border-box",
              direction: "inherit",
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-main)" }}>
                {editingEntry ? t("adspend.modalEditTitle") : t("adspend.modalCreateTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  border: "none",
                  background: "var(--bg-hover)",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Client Select */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.client")} *
                  </label>
                  <select
                    required
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- اختر العميل --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Picker */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.filterMonth")} * (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    required
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Platform */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.filterPlatform")}
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--bg-card)",
                      boxSizing: "border-box",
                    }}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {t(p.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campaign Name */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.campaign")}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: Promo Ramadhan / Collection Été"
                    value={form.campaignName}
                    onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Client Ad Budget */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.budget")} ({agencyCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="100000"
                    value={form.clientAdBudget}
                    onChange={(e) => setForm({ ...form, clientAdBudget: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Actual Spend */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--danger)" }}>
                    {t("adspend.spend")} * ({agencyCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="85000"
                    value={form.actualSpend}
                    onChange={(e) => setForm({ ...form, actualSpend: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Amount Billed to Client */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--primary-color)" }}>
                    {t("adspend.billed")} * ({agencyCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="120000"
                    value={form.amountBilled}
                    onChange={(e) => setForm({ ...form, amountBilled: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Orders Generated */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("adspend.orders")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="350"
                    value={form.orders}
                    onChange={(e) => setForm({ ...form, orders: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Revenue Generated */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--success)" }}>
                    {t("adspend.revenue")} ({agencyCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="750000"
                    value={form.revenueGenerated}
                    onChange={(e) => setForm({ ...form, revenueGenerated: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Live Computed Metrics Box */}
                <div
                  style={{
                    gridColumn: "span 2",
                    background: "var(--bg-app)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-around",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>ROAS المحسوب</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: Number(modalROAS) >= 3 ? "#059669" : "var(--warning)" }}>
                      {modalROAS}x
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>CPA (تكلفة الطلب)</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>
                      {modalCPA} {agencyCurrency}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>هامش الوكالة</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: Number(modalMargin) >= 0 ? "#059669" : "var(--danger)" }}>
                      {modalMargin} {agencyCurrency}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    {t("common.notes")}
                  </label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--primary-color)",
                    color: "var(--bg-card)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {t("common.saved") || "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
