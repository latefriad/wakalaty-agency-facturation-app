import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const STATUS_CONFIG = {
  PLANNED: { color: "#64748b", bg: "#f1f5f9", labelKey: "testili.statusPlanned", icon: "🗓️" },
  RUNNING: { color: "#2563eb", bg: "#eff6ff", labelKey: "testili.statusRunning", icon: "▶️" },
  COMPLETED: { color: "#7c3aed", bg: "#ede9fe", labelKey: "testili.statusCompleted", icon: "🏁" },
};

const VERDICT_CONFIG = {
  WINNER: { color: "#16a34a", bg: "#dcfce7", labelKey: "testili.verdictWinner", icon: "🏆" },
  LOSER: { color: "#dc2626", bg: "#fee2e2", labelKey: "testili.verdictLoser", icon: "❌" },
  NEEDS_MORE_DATA: { color: "#d97706", bg: "#fef3c7", labelKey: "testili.verdictNeedsMoreData", icon: "⚠️" },
  PENDING: { color: "#64748b", bg: "#f1f5f9", labelKey: "testili.verdictPending", icon: "⏳" },
};

export default function Testili() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tests, setTests] = useState([]);
  const [summary, setSummary] = useState({
    totalTests: 0,
    winnersCount: 0,
    winnerRate: 0,
    totalBudget: 0,
    totalSpent: 0,
  });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedVerdict, setSelectedVerdict] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    productName: "",
    productUrl: "",
    clientId: "",
    platform: "META",
    testBudget: "",
    amountSpent: "",
    orders: 0,
    targetCPA: "",
    targetROAS: "",
    actualCPA: "",
    actualROAS: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    status: "PLANNED",
    verdict: "PENDING",
    verdictNotes: "",
  });

  // Ad Spend Quick Entry Modal State
  const [adSpendModalOpen, setAdSpendModalOpen] = useState(false);
  const [adSpendTargetTest, setAdSpendTargetTest] = useState(null);
  const [adSpendMonth, setAdSpendMonth] = useState(new Date().toISOString().slice(0, 7));
  const [adSpendBilled, setAdSpendBilled] = useState("");
  const [adSpendRevenue, setAdSpendRevenue] = useState("");
  const [adSpendSaving, setAdSpendSaving] = useState(false);

  // Fetch tests and clients
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedClient) params.clientId = selectedClient;
      if (selectedPlatform) params.platform = selectedPlatform;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedVerdict) params.verdict = selectedVerdict;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [resTests, resClients] = await Promise.all([
        api.get("/testili", params),
        api.get("/clients"),
      ]);

      setTests(resTests.data?.tests || []);
      setSummary(
        resTests.data?.summary || {
          totalTests: 0,
          winnersCount: 0,
          winnerRate: 0,
          totalBudget: 0,
          totalSpent: 0,
        }
      );
      setClients(resClients.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, selectedPlatform, selectedStatus, selectedVerdict, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTest(null);
    setFormData({
      productName: "",
      productUrl: "",
      clientId: clients[0]?.id || "",
      platform: "META",
      testBudget: "",
      amountSpent: "",
      orders: 0,
      targetCPA: "",
      targetROAS: "",
      actualCPA: "",
      actualROAS: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      status: "PLANNED",
      verdict: "PENDING",
      verdictNotes: "",
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (test) => {
    setEditingTest(test);
    setFormData({
      productName: test.productName || "",
      productUrl: test.productUrl || "",
      clientId: test.clientId || "",
      platform: test.platform || "META",
      testBudget: test.testBudget ?? "",
      amountSpent: test.amountSpent ?? "",
      orders: test.orders ?? 0,
      targetCPA: test.targetCPA ?? "",
      targetROAS: test.targetROAS ?? "",
      actualCPA: test.actualCPA ?? "",
      actualROAS: test.actualROAS ?? "",
      startDate: test.startDate ? test.startDate.slice(0, 10) : "",
      endDate: test.endDate ? test.endDate.slice(0, 10) : "",
      status: test.status || "PLANNED",
      verdict: test.verdict || "PENDING",
      verdictNotes: test.verdictNotes || "",
    });
    setIsModalOpen(true);
  };

  // Auto-calculate suggested verdict on form data change
  const computeLiveSuggestion = () => {
    const actROAS = formData.actualROAS !== "" ? Number(formData.actualROAS) : null;
    const tgtROAS = formData.targetROAS !== "" ? Number(formData.targetROAS) : null;
    const actCPA =
      formData.actualCPA !== ""
        ? Number(formData.actualCPA)
        : Number(formData.orders) > 0 && Number(formData.amountSpent) > 0
        ? Number((Number(formData.amountSpent) / Number(formData.orders)).toFixed(2))
        : null;
    const tgtCPA = formData.targetCPA !== "" ? Number(formData.targetCPA) : null;
    const spent = Number(formData.amountSpent || 0);
    const budget = Number(formData.testBudget || 0);

    const roasWinner = tgtROAS != null && tgtROAS > 0 && actROAS != null && actROAS >= tgtROAS;
    const cpaWinner = tgtCPA != null && tgtCPA > 0 && actCPA != null && actCPA <= tgtCPA;

    if (roasWinner || cpaWinner) return "WINNER";
    if (budget > 0 && spent >= budget) return "LOSER";
    if (budget > 0 && spent >= 0.5 * budget) return "NEEDS_MORE_DATA";
    return "PENDING";
  };

  // Submit Create / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTest) {
        await api.put(`/testili/${editingTest.id}`, formData);
        toast.success(t("common.saved") || "Enregistré avec succès");
      } else {
        await api.post("/testili", formData);
        toast.success(t("common.created") || "Créé avec succès");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  // Quick Verdict Apply
  const handleApplySuggestedVerdict = async (test) => {
    if (!test.suggestedVerdict || test.suggestedVerdict === test.verdict) return;
    try {
      await api.patch(`/testili/${test.id}/verdict`, {
        verdict: test.suggestedVerdict,
      });
      toast.success(t("common.updated") || "Mis à jour");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // Delete Test
  const handleDelete = async (testId) => {
    if (!window.confirm(t("testili.deleteConfirm"))) return;
    try {
      await api.delete(`/testili/${testId}`);
      toast.success(t("common.deleted") || "Supprimé");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // Open Quick Ad Spend Entry Modal
  const handleOpenAdSpendModal = (test) => {
    setAdSpendTargetTest(test);
    setAdSpendMonth(new Date().toISOString().slice(0, 7));
    setAdSpendBilled(test.amountSpent ? String(Math.round(test.amountSpent * 1.2)) : "");
    setAdSpendRevenue(test.amountSpent && test.actualROAS ? String(Math.round(test.amountSpent * test.actualROAS)) : "");
    setAdSpendModalOpen(true);
  };

  // Submit Quick Ad Spend Entry
  const handleCreateAdSpendEntry = async (e) => {
    e.preventDefault();
    if (!adSpendTargetTest) return;
    setAdSpendSaving(true);
    try {
      await api.post("/adspend", {
        clientId: adSpendTargetTest.clientId,
        month: adSpendMonth,
        platform: adSpendTargetTest.platform,
        campaignName: `Testili - ${adSpendTargetTest.productName}`,
        clientAdBudget: Number(adSpendTargetTest.testBudget || 0),
        actualSpend: Number(adSpendTargetTest.amountSpent || 0),
        amountBilled: Number(adSpendBilled || 0),
        orders: Number(adSpendTargetTest.orders || 0),
        revenueGenerated: Number(adSpendRevenue || 0),
        notes: `Importé depuis Testili (${adSpendTargetTest.verdict})`,
      });
      toast.success(t("dashExtras.goalSaved") || "Entrée Ad Spend créée !");
      setAdSpendModalOpen(false);
      navigate("/adspend");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setAdSpendSaving(false);
    }
  };

  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
  const cur = t("common.currency");
  const liveSuggestedVerdict = computeLiveSuggestion();

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🧪</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              {t("testili.title")}
            </h1>
          </div>
          <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 14 }}>
            {t("testili.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View toggle */}
          <div
            style={{
              display: "flex",
              background: "#e2e8f0",
              borderRadius: 8,
              padding: 3,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "cards" ? "#fff" : "transparent",
                color: viewMode === "cards" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              🗂️ {t("testili.viewCards")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "table" ? "#fff" : "transparent",
                color: viewMode === "table" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              📑 {t("testili.viewTable")}
            </button>
          </div>

          {/* New Test Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
            }}
          >
            <span>+</span> {t("testili.newTest")}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Tests */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            🧪
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>
              {summary.totalTests}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              {t("testili.totalTests")}
            </div>
          </div>
        </div>

        {/* Winner Rate */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            🏆
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>
              {summary.winnerRate}%
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              {t("testili.winnersCount", { count: summary.winnersCount })}
            </div>
          </div>
        </div>

        {/* Budget vs Spent */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              {t("testili.totalSpent")} / {t("testili.totalBudget")}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>
              {summary.totalBudget > 0
                ? Math.round((summary.totalSpent / summary.totalBudget) * 100)
                : 0}
              %
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
            {fmt(summary.totalSpent)}{" "}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#64748b" }}>
              / {fmt(summary.totalBudget)} {cur}
            </span>
          </div>
          <div style={{ background: "#f1f5f9", borderRadius: 99, height: 7, overflow: "hidden" }}>
            <div
              style={{
                width: `${
                  summary.totalBudget > 0
                    ? Math.min(100, (summary.totalSpent / summary.totalBudget) * 100)
                    : 0
                }%`,
                height: "100%",
                background: "#2563eb",
                borderRadius: 99,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 16,
          border: "1px solid #e2e8f0",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder={`🔍 ${t("common.search")}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Client filter */}
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">👥 {t("common.allClients") || "Tous les clients"}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.company ? `(${c.company})` : ""}
            </option>
          ))}
        </select>

        {/* Platform filter */}
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">🌐 {t("testili.platform")}: {t("common.all") || "Toutes"}</option>
          <option value="META">Meta Ads (FB/IG)</option>
          <option value="TIKTOK">TikTok Ads</option>
        </select>

        {/* Status filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">📌 {t("common.status")}: {t("common.all") || "Tous"}</option>
          <option value="PLANNED">{t("testili.statusPlanned")}</option>
          <option value="RUNNING">{t("testili.statusRunning")}</option>
          <option value="COMPLETED">{t("testili.statusCompleted")}</option>
        </select>

        {/* Verdict filter */}
        <select
          value={selectedVerdict}
          onChange={(e) => setSelectedVerdict(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">⚖️ {t("testili.verdictLabel")}: {t("common.all") || "Tous"}</option>
          <option value="WINNER">{t("testili.verdictWinner")}</option>
          <option value="LOSER">{t("testili.verdictLoser")}</option>
          <option value="NEEDS_MORE_DATA">{t("testili.verdictNeedsMoreData")}</option>
          <option value="PENDING">{t("testili.verdictPending")}</option>
        </select>
      </div>

      {/* Main Content Area: Cards or Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>
          ⏳ {t("common.loading")}...
        </div>
      ) : tests.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 60,
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🧪</div>
          <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b", fontWeight: 700 }}>
            {t("testili.noTests")}
          </h3>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {tests.map((test) => {
            const stCfg = STATUS_CONFIG[test.status] || STATUS_CONFIG.PLANNED;
            const vdCfg = VERDICT_CONFIG[test.verdict] || VERDICT_CONFIG.PENDING;
            const hasSuggestion =
              test.suggestedVerdict && test.suggestedVerdict !== test.verdict;

            return (
              <div
                key={test.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 20,
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div>
                  {/* Top line: Platform + Status + Verdict */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: test.platform === "TIKTOK" ? "#fdf2f8" : "#eff6ff",
                        color: test.platform === "TIKTOK" ? "#db2777" : "#2563eb",
                        border: `1px solid ${
                          test.platform === "TIKTOK" ? "#fbcfe8" : "#bfdbfe"
                        }`,
                      }}
                    >
                      {test.platform === "TIKTOK" ? "🎵 TikTok" : "📘 Meta"}
                    </span>

                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: stCfg.bg,
                          color: stCfg.color,
                        }}
                      >
                        {stCfg.icon} {t(stCfg.labelKey)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: vdCfg.bg,
                          color: vdCfg.color,
                        }}
                      >
                        {vdCfg.icon} {t(vdCfg.labelKey)}
                      </span>
                    </div>
                  </div>

                  {/* Product Title */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.3,
                        }}
                      >
                        {test.productName}
                      </h3>
                      {test.productUrl && (
                        <a
                          href={test.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open URL"
                          style={{
                            color: "#3b82f6",
                            textDecoration: "none",
                            fontSize: 13,
                          }}
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    {test.client && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        👤 {test.client.name}{" "}
                        {test.client.company ? `(${test.client.company})` : ""}
                      </div>
                    )}
                  </div>

                  {/* Suggested Verdict Banner if mismatch */}
                  {hasSuggestion && (
                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px dashed #86efac",
                        padding: "6px 10px",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 11,
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ color: "#15803d", fontWeight: 600 }}>
                        {t("testili.suggestedNotice", {
                          verdict: t(
                            VERDICT_CONFIG[test.suggestedVerdict]?.labelKey ||
                              "testili.verdictPending"
                          ),
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplySuggestedVerdict(test)}
                        style={{
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("testili.applySuggested")}
                      </button>
                    </div>
                  )}

                  {/* Budget & Spend Progress */}
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: "#64748b" }}>{t("testili.amountSpent")}:</span>
                      <span style={{ fontWeight: 600 }}>
                        {fmt(test.amountSpent)}{" "}
                        <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                          / {fmt(test.testBudget)} {cur}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        background: "#f1f5f9",
                        borderRadius: 99,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, test.budgetUsedPercent || 0)}%`,
                          height: "100%",
                          borderRadius: 99,
                          background:
                            test.budgetUsedPercent >= 100
                              ? "#ef4444"
                              : test.budgetUsedPercent >= 75
                              ? "#f59e0b"
                              : "#2563eb",
                        }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid: CPA, ROAS, Orders */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                      background: "#f8fafc",
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>CPA (Reel/Cible)</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        {test.effectiveCPA != null ? fmt(test.effectiveCPA) : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        obj: {test.targetCPA != null ? fmt(test.targetCPA) : "—"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>ROAS (Reel/Cible)</div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            test.actualROAS != null &&
                            test.targetROAS != null &&
                            test.actualROAS >= test.targetROAS
                              ? "#16a34a"
                              : "#0f172a",
                        }}
                      >
                        {test.actualROAS != null ? `${test.actualROAS}x` : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        obj: {test.targetROAS != null ? `${test.targetROAS}x` : "—"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {t("testili.orders")}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>
                        {test.orders || 0}
                      </div>
                    </div>
                  </div>

                  {/* Verdict Notes if present */}
                  {test.verdictNotes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        background: "#fffbeb",
                        padding: "8px 10px",
                        borderRadius: 6,
                        borderInlineStart: "3px solid #f59e0b",
                        marginBottom: 14,
                        fontStyle: "italic",
                      }}
                    >
                      "{test.verdictNotes}"
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 12,
                  }}
                >
                  {/* Create Ad Spend shortcut button */}
                  <button
                    type="button"
                    onClick={() => handleOpenAdSpendModal(test)}
                    title={t("testili.createAdSpendTooltip")}
                    style={{
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    📈 {t("testili.createAdSpend")}
                  </button>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(test)}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      ✏️
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(test.id)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fecaca",
                          color: "#dc2626",
                          padding: "5px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#64748b", fontSize: 12, textAlign: "start" }}>
                <th style={{ padding: "12px 14px", textAlign: "start" }}>{t("testili.productName")}</th>
                <th style={{ padding: "12px 14px", textAlign: "start" }}>{t("testili.client")}</th>
                <th style={{ padding: "12px 14px", textAlign: "start" }}>{t("testili.platform")}</th>
                <th style={{ padding: "12px 14px", textAlign: "start" }}>{t("common.status")}</th>
                <th style={{ padding: "12px 14px", textAlign: "start" }}>{t("testili.verdictLabel")}</th>
                <th style={{ padding: "12px 14px", textAlign: "end" }}>{t("testili.amountSpent")}</th>
                <th style={{ padding: "12px 14px", textAlign: "end" }}>CPA</th>
                <th style={{ padding: "12px 14px", textAlign: "end" }}>ROAS</th>
                <th style={{ padding: "12px 14px", textAlign: "end" }}>{t("testili.orders")}</th>
                <th style={{ padding: "12px 14px", textAlign: "center" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => {
                const stCfg = STATUS_CONFIG[test.status] || STATUS_CONFIG.PLANNED;
                const vdCfg = VERDICT_CONFIG[test.verdict] || VERDICT_CONFIG.PENDING;

                return (
                  <tr key={test.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {test.productName}
                      </div>
                      {test.productUrl && (
                        <a
                          href={test.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}
                        >
                          {test.productUrl.replace(/^https?:\/\//, "").slice(0, 30)}... ↗
                        </a>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#475569" }}>
                      {test.client?.name || "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: test.platform === "TIKTOK" ? "#fdf2f8" : "#eff6ff",
                          color: test.platform === "TIKTOK" ? "#db2777" : "#2563eb",
                        }}
                      >
                        {test.platform === "TIKTOK" ? "TikTok" : "Meta"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: stCfg.bg,
                          color: stCfg.color,
                        }}
                      >
                        {stCfg.icon} {t(stCfg.labelKey)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: vdCfg.bg,
                          color: vdCfg.color,
                        }}
                      >
                        {vdCfg.icon} {t(vdCfg.labelKey)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "end", fontWeight: 600 }}>
                      {fmt(test.amountSpent)}{" "}
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>
                        / {fmt(test.testBudget)} {cur}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "end" }}>
                      {test.effectiveCPA != null ? `${fmt(test.effectiveCPA)} ${cur}` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "end",
                        fontWeight: 600,
                        color:
                          test.actualROAS != null &&
                          test.targetROAS != null &&
                          test.actualROAS >= test.targetROAS
                            ? "#16a34a"
                            : "#0f172a",
                      }}
                    >
                      {test.actualROAS != null ? `${test.actualROAS}x` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "end", fontWeight: 700 }}>
                      {test.orders || 0}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenAdSpendModal(test)}
                          title={t("testili.createAdSpend")}
                          style={{
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          📈
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(test)}
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            padding: "4px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          ✏️
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(test.id)}
                            style={{
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                              padding: "4px 8px",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
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
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              direction: "inherit",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingTest ? t("testili.editTest") : t("testili.newTest")}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Product Name & URL */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.productName")} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Smart Watch Ultra"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.client")} *
                  </label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="">-- {t("testili.client")} --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product URL & Platform */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.productUrl")}
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.productUrl}
                    onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.platform")}
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="META">📘 Meta Ads</option>
                    <option value="TIKTOK">🎵 TikTok Ads</option>
                  </select>
                </div>
              </div>

              {/* Budget & Spend */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.testBudget")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.testBudget}
                    onChange={(e) => setFormData({ ...formData, testBudget: e.target.value })}
                    placeholder="e.g. 15000"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.amountSpent")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.amountSpent}
                    onChange={(e) => setFormData({ ...formData, amountSpent: e.target.value })}
                    placeholder="e.g. 5000"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.orders")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.orders}
                    onChange={(e) => setFormData({ ...formData, orders: e.target.value })}
                    placeholder="0"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Progress bar preview in modal */}
              {Number(formData.testBudget) > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: "#64748b" }}>Progression du budget de test:</span>
                    <span style={{ fontWeight: 600 }}>
                      {Math.round((Number(formData.amountSpent || 0) / Number(formData.testBudget)) * 100)}%
                    </span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 99, height: 6, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, (Number(formData.amountSpent || 0) / Number(formData.testBudget)) * 100)}%`,
                        height: "100%",
                        background: "#2563eb",
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Targets vs Actuals (CPA & ROAS) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {t("testili.targetCPA")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formData.targetCPA}
                    onChange={(e) => setFormData({ ...formData, targetCPA: e.target.value })}
                    placeholder="e.g. 800"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {t("testili.actualCPA")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formData.actualCPA}
                    onChange={(e) => setFormData({ ...formData, actualCPA: e.target.value })}
                    placeholder="Auto or e.g. 650"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {t("testili.targetROAS")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.targetROAS}
                    onChange={(e) => setFormData({ ...formData, targetROAS: e.target.value })}
                    placeholder="e.g. 3.0"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {t("testili.actualROAS")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.actualROAS}
                    onChange={(e) => setFormData({ ...formData, actualROAS: e.target.value })}
                    placeholder="e.g. 3.5"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Dates & Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.startDate")}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("testili.endDate")}
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {t("common.status")}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="PLANNED">{t("testili.statusPlanned")}</option>
                    <option value="RUNNING">{t("testili.statusRunning")}</option>
                    <option value="COMPLETED">{t("testili.statusCompleted")}</option>
                  </select>
                </div>
              </div>

              {/* Verdict & Auto-suggestion */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    {t("testili.verdictLabel")}
                  </label>
                  {/* Live Suggestion banner */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                      {t("testili.suggestedNotice", {
                        verdict: t(VERDICT_CONFIG[liveSuggestedVerdict]?.labelKey || "testili.verdictPending"),
                      })}
                    </span>
                    {formData.verdict !== liveSuggestedVerdict && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, verdict: liveSuggestedVerdict })}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: "1px solid #93c5fd",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("testili.applySuggested")}
                      </button>
                    )}
                  </div>
                </div>

                <select
                  value={formData.verdict}
                  onChange={(e) => setFormData({ ...formData, verdict: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#fff",
                  }}
                >
                  <option value="PENDING">{t("testili.verdictPending")}</option>
                  <option value="WINNER">{t("testili.verdictWinner")}</option>
                  <option value="LOSER">{t("testili.verdictLoser")}</option>
                  <option value="NEEDS_MORE_DATA">{t("testili.verdictNeedsMoreData")}</option>
                </select>
              </div>

              {/* Verdict Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {t("testili.verdictNotes")}
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Winner validé sur audience 25-45, coût par achat très bas..."
                  value={formData.verdictNotes}
                  onChange={(e) => setFormData({ ...formData, verdictNotes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "..." : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Ad Spend Entry Modal */}
      {adSpendModalOpen && adSpendTargetTest && (
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
          onClick={() => setAdSpendModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              direction: "inherit",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                📈 {t("testili.createAdSpend")}
              </h3>
              <button
                type="button"
                onClick={() => setAdSpendModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Transférez les dépenses et résultats de l'analyse <strong>"{adSpendTargetTest.productName}"</strong> vers le module Ad Spend.
            </p>

            <form onSubmit={handleCreateAdSpendEntry}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {t("common.month") || "Mois (YYYY-MM)"}
                </label>
                <input
                  type="month"
                  required
                  value={adSpendMonth}
                  onChange={(e) => setAdSpendMonth(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Dépensé réel (DZD)
                  </label>
                  <input
                    type="number"
                    disabled
                    value={adSpendTargetTest.amountSpent || 0}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Facturé au client (DZD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adSpendBilled}
                    onChange={(e) => setAdSpendBilled(e.target.value)}
                    placeholder="e.g. 20000"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Chiffre d'affaires généré estimé (DZD)
                </label>
                <input
                  type="number"
                  min="0"
                  value={adSpendRevenue}
                  onChange={(e) => setAdSpendRevenue(e.target.value)}
                  placeholder="e.g. 50000"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdSpendModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={adSpendSaving}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: adSpendSaving ? "not-allowed" : "pointer",
                    opacity: adSpendSaving ? 0.7 : 1,
                  }}
                >
                  {adSpendSaving ? "..." : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
