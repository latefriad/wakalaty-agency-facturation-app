import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function DashboardExtras({ range }) {
  const { t } = useLang();
  const { isAdmin, profile } = useAuth();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTargetInput, setGoalTargetInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  const fetchExtras = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        month: selectedMonth,
      };
      if (range?.from) params.from = range.from;
      if (range?.to) params.to = range.to;

      const res = await api.get("/dashboard-extras", params);
      setExtras(res.data);
    } catch (err) {
      // If 403 or network error, silently handle or record
      console.error("DashboardExtras fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [range?.from, range?.to, selectedMonth]);

  useEffect(() => {
    fetchExtras();
  }, [fetchExtras]);

  const handleOpenGoalModal = () => {
    setGoalTargetInput(extras?.goalProgress?.targetAmount ?? 0);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setGoalSaving(true);
    try {
      await api.post("/dashboard-extras/goal", {
        month: selectedMonth,
        targetAmount: Number(goalTargetInput),
      });
      toast.success(t("dashExtras.goalSaved"));
      setIsGoalModalOpen(false);
      fetchExtras();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setGoalSaving(false);
    }
  };

  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
  const cur = t("common.currency");

  if (!extras && loading) {
    return (
      <div style={{ marginTop: 28, padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
        ⏳ {t("common.loading")}...
      </div>
    );
  }

  if (!extras) return null;

  const collectionRate = extras.collectionRate?.rate ?? 0;
  const collectionColor = collectionRate >= 80 ? "#10b981" : collectionRate >= 50 ? "#f59e0b" : "#ef4444";
  const collectionBg = collectionRate >= 80 ? "#d1fae5" : collectionRate >= 50 ? "#fef3c7" : "#fee2e2";

  const goalProgress = extras.goalProgress?.progress ?? 0;
  const goalTarget = extras.goalProgress?.targetAmount ?? 0;
  const goalCollected = extras.goalProgress?.collectedThisMonth ?? 0;

  return (
    <div style={{ marginTop: 32, marginBottom: 20 }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#eff6ff",
              color: "#2563eb",
              fontSize: 16,
            }}
          >
            ⚡
          </span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
            {t("dashExtras.title")}
          </h2>
        </div>

        {/* Month selector for Monthly Goal & Extras */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#fff",
              color: "#334155",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* KPI Cards: MRR, Collection Rate, Revenue Goal */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card 1: MRR */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🔄
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                {t("dashExtras.mrr")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
                {fmt(extras.mrr)} <span style={{ fontSize: 14, fontWeight: 600 }}>{cur}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              background: "#f8fafc",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #f1f5f9",
            }}
          >
            {t("dashExtras.activeSubscriptions", { count: extras.activeSubscriptionsCount })}
          </div>
        </div>

        {/* Card 2: Collection Rate */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: collectionBg,
                color: collectionColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🎯
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                {t("dashExtras.collectionRate")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: collectionColor, marginTop: 2 }}>
                {collectionRate}%
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: 99,
                height: 8,
                overflow: "hidden",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, collectionRate)}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: collectionColor,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#64748b", textAlign: "start" }}>
              {t("dashExtras.collectedVsBilled", {
                received: `${fmt(extras.collectionRate?.totalReceived)} ${cur}`,
                billed: `${fmt(extras.collectionRate?.totalBilled)} ${cur}`,
              })}
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Revenue Goal */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#fdf4ff",
                  color: "#a855f7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                🏆
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  {t("dashExtras.goalTitle")}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
                  {goalTarget > 0 ? (
                    <>
                      {fmt(goalCollected)}{" "}
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 400 }}>
                        / {fmt(goalTarget)} {cur}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
                      {t("dashExtras.noGoalSet")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Set Goal button for Admin */}
            {(isAdmin || profile?.role === "ADMIN") && (
              <button
                type="button"
                onClick={handleOpenGoalModal}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ✏️ {t("dashExtras.setGoal")}
              </button>
            )}
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              <span style={{ color: "#64748b" }}>{t("dashExtras.goalHint")}</span>
              <span style={{ color: goalProgress >= 100 ? "#10b981" : "#8b5cf6" }}>
                {goalProgress}%
              </span>
            </div>
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: 99,
                height: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, goalProgress)}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: goalProgress >= 100 ? "#10b981" : "#8b5cf6",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Clients by Profit Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>
            {t("dashExtras.topClients")}
          </h3>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {t("dashExtras.topClientsHint")}
          </div>
        </div>

        {(!extras.topClientsProfit || extras.topClientsProfit.length === 0) ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "24px 0", fontSize: 13 }}>
            {t("dashExtras.noClientsYet")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "start", color: "#64748b", fontSize: 12 }}>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("dash.client")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "end" }}>{t("dash.received")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "end" }}>{t("dash.outstandingCard")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "end" }}>{t("dash.directCosts")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "end" }}>{t("dash.profitCol")}</th>
                </tr>
              </thead>
              <tbody>
                {extras.topClientsProfit.map((c, idx) => (
                  <tr key={c.clientId || idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
                      {c.company && (
                        <div style={{ fontSize: 11, color: "#64748b" }}>{c.company}</div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        textAlign: "end",
                        color: "#10b981",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(c.received)}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        textAlign: "end",
                        color: "#f59e0b",
                      }}
                    >
                      {fmt(c.outstanding)}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        textAlign: "end",
                        color: "#64748b",
                      }}
                    >
                      {fmt(c.directCosts)}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        textAlign: "end",
                        fontWeight: 700,
                        color: c.profit >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {fmt(c.profit)} {cur}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set Goal Modal */}
      {isGoalModalOpen && (
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
          onClick={() => setIsGoalModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 440,
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {t("dashExtras.setGoalModalTitle", { month: selectedMonth })}
              </h3>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
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

            <form onSubmit={handleSaveGoal}>
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#334155",
                  }}
                >
                  {t("dashExtras.targetAmount")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={goalTargetInput}
                  onChange={(e) => setGoalTargetInput(e.target.value)}
                  placeholder="e.g. 500000"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 15,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
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
                  disabled={goalSaving}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: goalSaving ? "not-allowed" : "pointer",
                    opacity: goalSaving ? 0.7 : 1,
                  }}
                >
                  {goalSaving ? "..." : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
