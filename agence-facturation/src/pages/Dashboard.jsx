import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { api, apiDownload } from "../services/api";

const STATUS = {
  DRAFT: { color: "#64748b", bg: "#f1f5f9" },
  SENT: { color: "#3b82f6", bg: "#dbeafe" },
  EN_ATTENTE: { color: "#f59e0b", bg: "#fef3c7" },
  PAYEE: { color: "#10b981", bg: "#d1fae5" },
  ANNULEE: { color: "#ef4444", bg: "#fee2e2" },
};

// Bornes de période envoyées au serveur (tous les calculs restent en base :
// le front n'agrège plus rien lui-même).
function periodRange(key) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const to = iso(now);
  switch (key) {
    case "month":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case "quarter":
      return { from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to };
    case "year":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
    default: // 12 derniers mois
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to };
  }
}

export default function Dashboard() {
  const { t } = useLang();

  const [dash, setDash] = useState(null);
  const [period, setPeriod] = useState("12m");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = period === "custom" && custom.from && custom.to ? custom : periodRange(period);

  useEffect(() => {
    let isMounted = true;
    setError(null);
    setLoading(true);
    api
      .get("/dashboard", { from: range.from, to: range.to })
      .then((res) => isMounted && setDash(res.data))
      .catch((e) => isMounted && setError(e))
      .finally(() => isMounted && setLoading(false));
    return () => { isMounted = false; };
  }, [range.from, range.to]);

  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
  const cur = t("common.currency");

  const cashSeries = dash?.cashSeries ?? [];
  const maxMonthly = Math.max(1, ...cashSeries.map((m) => m.received));
  const statusTotal = Math.max(1, (dash?.statusBreakdown ?? []).reduce((s, r) => s + r.count, 0));

  if (loading && !dash) return <div style={{ textAlign: "center", padding: 80, color: "#64748b", fontSize: 16 }}>⏳ {t("common.loading")}</div>;

  if (error)
    return (
      <div style={{ textAlign: "center", padding: 80, direction: "inherit", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "#ef4444", marginBottom: 8, fontSize: 18 }}>{t("dash.loadError")}</h2>
        <p style={{ color: "#64748b", marginBottom: 16, fontSize: 14 }}>{t("dash.checkConnection")}</p>
        <button onClick={() => { setError(null); window.location.reload(); }} style={{ padding: "10px 24px", borderRadius: 10, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>{t("common.retry")}</button>
      </div>
    );

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t("dash.welcome")}</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>{t("dash.subtitle")}</p>
        </div>

        {/* Filtre de période (appliqué serveur) + exports */}
        <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => apiDownload(`/dashboard/export.xlsx?from=${range.from}&to=${range.to}`, `wakalati-finance-${range.from}_${range.to}.xlsx`).catch((e) => toast.error(e.message))}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ⬇️ Excel
          </button>
          <button onClick={() => window.print()}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            🖨️ PDF
          </button>
          <span style={{ width: 8 }} />
          {[
            { key: "month", label: t("dash.periodMonth") },
            { key: "quarter", label: t("dash.periodQuarter") },
            { key: "year", label: t("dash.periodYear") },
            { key: "12m", label: t("dash.period12m") },
            { key: "custom", label: t("dash.periodCustom") },
          ].map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid", borderColor: period === p.key ? "#3b82f6" : "#e2e8f0", background: period === p.key ? "#3b82f6" : "#fff", color: period === p.key ? "#fff" : "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <>
              <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="form-input" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} />
              <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="form-input" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} />
            </>
          )}
        </div>
      </div>

      {/* Chiffre titre : la trésorerie — solde initial (calage saisi dans le
          profil agence) + tous les encaissements − toutes les dépenses.
          C'est une photo, indépendante de la période filtrée. */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a5f)", borderRadius: 16, padding: "24px 28px", marginBottom: 20, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>🏦 {t("dash.treasury")}</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 4, color: (dash?.treasury?.balance ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
            {fmt(dash?.treasury?.balance)} {cur}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{t("dash.treasuryHint")}</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          <div>
            <div style={{ opacity: 0.6 }}>{t("dash.treasuryIn")}</div>
            <div style={{ fontWeight: 700, color: "#4ade80" }}>+{fmt(dash?.treasury?.totalReceived)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6 }}>{t("dash.treasuryOut")}</div>
            <div style={{ fontWeight: 700, color: "#f87171" }}>−{fmt(dash?.treasury?.totalSpent)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6 }}>{t("dash.openingBalance")}</div>
            <div style={{ fontWeight: 700 }}>{fmt(dash?.treasury?.openingBalance)}</div>
          </div>
        </div>
      </div>

      {/* Cartes principales — définitions exactes : encaissé = paiements reçus
          sur la période ; facturé = documents émis ; encours/retard = photo
          actuelle du reste à payer ; bénéfice = encaissé − dépenses (caisse). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: t("dash.received"), sub: t("dash.receivedHint"), value: `${fmt(dash?.cash?.received)} ${cur}`, icon: "💰", color: "#10b981", bg: "#d1fae5" },
          { label: t("dash.expensesCard"), sub: `${dash?.expenses?.count ?? 0} ${t("dash.expensesShort")}`, value: `${fmt(dash?.expenses?.total)} ${cur}`, icon: "💸", color: "#f97316", bg: "#ffedd5" },
          { label: t("dash.netProfit"), sub: dash?.profit?.margin != null ? `${t("dash.margin")} ${(dash.profit.margin * 100).toFixed(1)}%` : t("dash.noCashYet"), value: `${fmt(dash?.profit?.net)} ${cur}`, icon: "🏆", color: (dash?.profit?.net ?? 0) >= 0 ? "#10b981" : "#ef4444", bg: (dash?.profit?.net ?? 0) >= 0 ? "#d1fae5" : "#fee2e2" },
          { label: t("dash.billed"), sub: t("dash.billedHint"), value: `${fmt(dash?.billed?.total)} ${cur}`, icon: "🧾", color: "#3b82f6", bg: "#dbeafe" },
          { label: t("dash.outstandingCard"), sub: `${dash?.outstanding?.count ?? 0} ${t("dash.invoicesShort")}`, value: `${fmt(dash?.outstanding?.total)} ${cur}`, icon: "⏳", color: "#f59e0b", bg: "#fef3c7" },
          { label: t("dash.overdue", { count: dash?.outstanding?.overdueCount ?? 0 }), sub: t("dash.overdueHint"), value: `${fmt(dash?.outstanding?.overdue)} ${cur}`, icon: "⏰", color: "#dc2626", bg: "#fee2e2" },
          { label: t("dash.payables"), sub: (dash?.payables?.overdue ?? 0) > 0 ? `⚠️ ${fmt(dash.payables.overdue)} ${t("dash.payablesOverdue")}` : `${dash?.payables?.count ?? 0} ${t("dash.invoicesShort")}`, value: `${fmt(dash?.payables?.total)} ${cur}`, icon: "🚚", color: "#7c3aed", bg: "#ede9fe" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{card.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: card.color, whiteSpace: "nowrap" }}>{card.value}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{card.label}</div>
              {card.sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{card.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Créances : ancienneté de l'encours (photo) + DSO + relances prioritaires */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("dash.aging")}</h3>
            <span title={t("dash.dsoHint")} style={{ background: "#ede9fe", color: "#7c3aed", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              DSO : {dash?.dso?.days != null ? `${dash.dso.days} ${t("dash.days")}` : "—"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>{t("dash.agingHint")}</div>
          {[
            { label: t("dash.agingNotDue"), value: dash?.aging?.notDue ?? 0, color: "#10b981" },
            { label: "1–30 " + t("dash.days"), value: dash?.aging?.days1to30 ?? 0, color: "#f59e0b" },
            { label: "31–60 " + t("dash.days"), value: dash?.aging?.days31to60 ?? 0, color: "#f97316" },
            { label: "60+ " + t("dash.days"), value: dash?.aging?.days60plus ?? 0, color: "#dc2626" },
          ].map((b) => {
            const totalAging = Math.max(1, dash?.outstanding?.total || 1);
            const pct = Math.round((b.value / totalAging) * 100);
            return (
              <div key={b.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "#475569" }}>{b.label}</span>
                  <span style={{ color: b.color, fontWeight: 600 }}>{fmt(b.value)} {cur}</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 99, height: 10 }}>
                  <div style={{ width: `${pct}%`, height: 10, borderRadius: 99, background: b.color, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.worstOverdue")}</h3>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>{t("dash.worstOverdueHint")}</div>
          {(dash?.worstOverdue ?? []).length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>✅ {t("dash.noOverdue")}</div>
          ) : (
            (dash?.worstOverdue ?? []).map((w) => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>{w.number}</div>
                  <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.clientName}</div>
                </div>
                <div style={{ textAlign: "end", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 14 }}>{fmt(w.remaining)} {cur}</div>
                  <div style={{ fontSize: 11, color: "#f97316", fontWeight: 600 }}>⏰ {w.daysLate} {t("dash.daysLate")}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16, marginBottom: 28 }}>
        {/* Encaissé par mois */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.cashCurve")}</h3>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>{t("dash.receivedHint")}</div>
          {cashSeries.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noDataYet")}</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
              {cashSeries.map((m) => (
                <div key={m.month} title={`${m.month}: ${fmt(m.received)} ${cur}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: "#10b981", height: `${Math.max(4, (m.received / maxMonthly) * 110)}px` }} />
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statuts des factures */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>{t("dash.invoiceStatus")}</h3>
          {(dash?.statusBreakdown ?? []).length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noInvoicesYet")}</div>
          ) : (
            (dash?.statusBreakdown ?? []).map((row) => {
              const st = STATUS[row.status] || STATUS.EN_ATTENTE;
              const pct = Math.round((row.count / statusTotal) * 100);
              return (
                <div key={row.status} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{t(`status.${row.status}`)}</span>
                    <span style={{ color: st.color, fontWeight: 600 }}>{row.count} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 99, height: 10 }}>
                    <div style={{ width: `${pct}%`, height: 10, borderRadius: 99, background: st.color, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Dépenses par catégorie (période) */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>{t("dash.expensesByCategory")}</h3>
          {(dash?.expenses?.byCategory ?? []).length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noExpensesYet")}</div>
          ) : (
            (dash?.expenses?.byCategory ?? []).map((row) => {
              const pct = Math.round((row.total / Math.max(1, dash?.expenses?.total || 1)) * 100);
              return (
                <div key={row.category} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{t(`exp.cat.${row.category}`)}</span>
                    <span style={{ color: "#f97316", fontWeight: 600 }}>{fmt(row.total)} {cur} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 99, height: 10 }}>
                    <div style={{ width: `${pct}%`, height: 10, borderRadius: 99, background: "#f97316", transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Top clients par encaissé */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.topClients")}</h3>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>{t("dash.topClientsHint")}</div>
          {(dash?.topClients ?? []).length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noRevenueYet")}</div>
          ) : (
            (dash?.topClients ?? []).map((c, i) => (
              <div key={c.clientId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 14 }}>{["🥇", "🥈", "🥉", "4.", "5."][i]} {c.name}</span>
                <span style={{ fontWeight: 700, color: "#10b981", fontSize: 14 }}>{fmt(c.received)} {cur}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Budget vs réel + prévision de trésorerie */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.budgetTitle")}</h3>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>{t("dash.budgetHint")}</div>
          {!dash?.budget?.defined ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 13 }}>
              {t("dash.noBudget")}
            </div>
          ) : (
            <>
              {/* Objectif d'encaissements */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "#475569", fontWeight: 600 }}>💰 {t("dash.revenueTarget")}</span>
                  <span style={{ fontWeight: 700, color: dash.budget.revenueActual >= dash.budget.revenueTarget ? "#10b981" : "#475569" }}>
                    {fmt(dash.budget.revenueActual)} / {fmt(dash.budget.revenueTarget)} {cur}
                  </span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 99, height: 12 }}>
                  <div style={{ width: `${Math.min(100, Math.round((dash.budget.revenueActual / Math.max(1, dash.budget.revenueTarget)) * 100))}%`, height: 12, borderRadius: 99, background: "#10b981", transition: "width 0.5s ease" }} />
                </div>
              </div>
              {/* Plafonds de dépenses par catégorie */}
              {dash.budget.byCategory.map((row) => {
                const over = row.actual > row.budget && row.budget > 0;
                const pct = Math.min(100, Math.round((row.actual / Math.max(1, row.budget || row.actual)) * 100));
                return (
                  <div key={row.category} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: "#475569" }}>{t(`exp.cat.${row.category}`)}{over && " ⚠️"}</span>
                      <span style={{ color: over ? "#dc2626" : "#64748b", fontWeight: 600 }}>
                        {fmt(row.actual)} / {row.budget > 0 ? fmt(row.budget) : "—"} {cur}
                      </span>
                    </div>
                    <div style={{ background: "#f1f5f9", borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${pct}%`, height: 8, borderRadius: 99, background: over ? "#dc2626" : "#3b82f6", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.forecastTitle")}</h3>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>{t("dash.forecastHint")}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "2px solid #e2e8f0", marginBottom: 4 }}>
            <span style={{ color: "#475569", fontWeight: 600 }}>{t("dash.forecastStart")}</span>
            <span style={{ fontWeight: 700 }}>{fmt(dash?.forecast?.startingBalance)} {cur}</span>
          </div>
          {(dash?.forecast?.months ?? []).map((m) => (
            <div key={m.month} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>📅 {m.month}</span>
                <span style={{ fontWeight: 800, color: m.projectedBalance >= 0 ? "#10b981" : "#dc2626" }}>
                  {m.projectedBalance < 0 && "⚠️ "}{fmt(m.projectedBalance)} {cur}
                </span>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                <span style={{ color: "#10b981" }}>+{fmt(m.expectedIn)} {t("dash.forecastIn")}</span>
                <span style={{ color: "#f97316" }}>
                  −{fmt(m.expectedOut)} {t(m.expectedOutSource === "payables" ? "dash.forecastOutPayables" : m.expectedOutSource === "budget" ? "dash.forecastOutBudget" : "dash.forecastOutAvg")}
                </span>
                {m.payablesDue > 0 && m.expectedOutSource !== "payables" && (
                  <span style={{ color: "#7c3aed" }}>🚚 {fmt(m.payablesDue)} {t("dash.forecastPayablesDue")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rentabilité par client — encaissé période, encours, coûts directs
          (service_charges si renseignées) ; les charges générales ne sont pas
          ventilées par client. */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", marginBottom: 28 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("dash.clientProfit")}</h3>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>{t("dash.clientProfitHint")}</div>
        {(dash?.clientProfit ?? []).length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noDataYet")}</div>
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
                {(dash?.clientProfit ?? []).map((c) => (
                  <tr key={c.clientId} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "9px 10px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "9px 10px", textAlign: "end", color: "#10b981", fontWeight: 600 }}>{fmt(c.received)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "end", color: "#f59e0b" }}>{fmt(c.outstanding)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "end", color: "#64748b" }}>{fmt(c.directCosts)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "end", fontWeight: 700, color: c.profit >= 0 ? "#10b981" : "#ef4444" }}>
                      {fmt(c.profit)} {cur}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dernières factures */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>{t("dash.recentInvoices")}</h3>
        {(dash?.recentInvoices ?? []).length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>{t("dash.noInvoicesYet")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(dash?.recentInvoices ?? []).map((inv) => {
              const st = STATUS[inv.status] || STATUS.EN_ATTENTE;
              return (
                <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "12px", borderBottom: "1px solid #f1f5f9", fontSize: 14, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#3b82f6" }}>{inv.number || t("inv.draftLabel")}</span>
                  <span style={{ color: "#475569" }}>{inv.client?.name || t("dash.client")}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(inv.total)} {inv.currency !== "DZD" ? inv.currency : cur}</span>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg, width: "fit-content" }}>{t(`status.${STATUS[inv.status] ? inv.status : "EN_ATTENTE"}`)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
