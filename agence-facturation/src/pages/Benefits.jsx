import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { api } from "../services/api";
import toast from "react-hot-toast";

// ─── Expense category labels ──────────────────────────────────────────────
const CAT_LABELS = {
  SALAIRE:      { ar: "الرواتب",          fr: "Salaires",           icon: "👥" },
  LOYER:        { ar: "الإيجار",           fr: "Loyer",              icon: "🏠" },
  ADS:          { ar: "إنفاق الإعلانات",  fr: "Dépenses Ads",       icon: "📢" },
  LOGICIEL:     { ar: "البرامج",           fr: "Logiciels",          icon: "💻" },
  MATERIEL:     { ar: "معدات",             fr: "Matériel",           icon: "🖥️" },
  TRANSPORT:    { ar: "المواصلات",         fr: "Transport",          icon: "🚗" },
  REPAS:        { ar: "وجبات",             fr: "Repas",              icon: "🍽️" },
  FORMATION:    { ar: "التدريب",           fr: "Formation",          icon: "📚" },
  COMMUNICATION:{ ar: "الاتصالات",        fr: "Communication",      icon: "📞" },
  AUTRE:        { ar: "أخرى",              fr: "Autres",             icon: "📦" },
};

function catLabel(cat, lang) {
  const c = CAT_LABELS[cat] || CAT_LABELS.AUTRE;
  return { icon: c.icon, label: lang === "ar" ? c.ar : c.fr };
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────
function MiniBarChart({ data, currency }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, padding: "8px 0" }}>
      {data.map((d) => (
        <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56 }}>
            <div title={`Revenus: ${d.revenue.toLocaleString("fr-DZ")}`}
              style={{ width: 12, background: "#3b82f6", borderRadius: "3px 3px 0 0",
                height: `${Math.round((d.revenue / maxVal) * 56)}px`, minHeight: 2 }} />
            <div title={`Dépenses: ${d.expenses.toLocaleString("fr-DZ")}`}
              style={{ width: 12, background: "#f87171", borderRadius: "3px 3px 0 0",
                height: `${Math.round((d.expenses / maxVal) * 56)}px`, minHeight: 2 }} />
            <div title={`Profit: ${d.profit.toLocaleString("fr-DZ")}`}
              style={{ width: 12, background: d.profit >= 0 ? "#10b981" : "#f59e0b",
                borderRadius: "3px 3px 0 0",
                height: `${Math.round((Math.abs(d.profit) / maxVal) * 56)}px`, minHeight: 2 }} />
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
            {d.month.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = "#1e40af", bg = "#eff6ff", border = "#bfdbfe", big = false }) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`, borderRadius: 14,
      padding: big ? "20px 24px" : "16px 20px", display: "flex", alignItems: "center", gap: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: big ? 36 : 28 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: big ? 26 : 20, fontWeight: "bold", color, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Benefits() {
  const { profile, agency } = useAuth();
  const { lang } = useLang();
  const isAdmin = profile?.role === "ADMIN";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  const currency = agency?.currency || "DZD";
  const fmt = (n) => Number(n || 0).toLocaleString("fr-DZ") + " " + currency;
  const fmtPct = (n) => (n == null ? "—" : Number(n).toFixed(1) + "%");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/benefits?month=${selectedMonth}`);
      setData(res.data);
    } catch (err) {
      toast.error(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        🔒 هذه الصفحة متاحة للمسؤول فقط / Cette section est réservée à l'administrateur.
      </div>
    );
  }

  const r = data;
  const netPositive = (r?.profit?.net || 0) >= 0;

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#1e293b" }}>
            💰 أرباحي الشخصية — Mes Bénéfices
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            ما دخل، ما خرج، وما تبقى لك — Ce que tu gagnes réellement
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <button
            onClick={fetchData}
            style={{ padding: "7px 16px", borderRadius: 8, background: "#1e40af", color: "#fff",
              border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>⏳ Chargement...</div>
      ) : r ? (
        <>
          {/* ── TOP: 3 Big KPIs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 20 }}>
            <KpiCard big icon="💵" label="الإيرادات المحصلة / Revenus encaissés"
              value={fmt(r.revenue.collected)}
              sub={`Facturé: ${fmt(r.revenue.invoiced)} | En attente: ${fmt(r.revenue.pending)}`}
              color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />

            <KpiCard big icon="📉" label="إجمالي المصاريف / Total Dépenses"
              value={fmt(r.expenses.total)}
              sub={`Dont salaires: ${fmt(r.expenses.salaries)}`}
              color="#dc2626" bg="#fef2f2" border="#fecaca" />

            <KpiCard big icon={netPositive ? "🤑" : "😬"}
              label="صافي الربح / Bénéfice Net"
              value={fmt(r.profit.net)}
              sub={`Marge: ${fmtPct(r.profit.margin)}`}
              color={netPositive ? "#059669" : "#d97706"}
              bg={netPositive ? "#ecfdf5" : "#fffbeb"}
              border={netPositive ? "#a7f3d0" : "#fde68a"} />
          </div>

          {/* ── ROW 2: Treasury + Ad Spend margin ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 24 }}>
            <KpiCard icon="🏦" label="الخزينة الكلية / Trésorerie globale"
              value={fmt(r.treasury)} color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" />
            <KpiCard icon="📢" label="هامش الإعلانات / Marge Ads"
              value={fmt(r.adSpend.margin)}
              sub={`Dépensé: ${fmt(r.adSpend.totalSpent)} | Facturé: ${fmt(r.adSpend.totalBilled)}`}
              color="#0e7490" bg="#ecfeff" border="#a5f3fc" />
            <KpiCard icon="📦" label="إيرادات الإعلانات / Revenus Ads clients"
              value={fmt(r.adSpend.revenue)}
              sub={`Commandes: ${r.adSpend.orders} | ROAS moy: ${r.adSpend.avgROAS}x`}
              color="#1e40af" bg="#eff6ff" border="#bfdbfe" />
            <KpiCard icon="👥" label="رواتب الموظفين / Masse salariale"
              value={fmt(r.expenses.salaries)}
              sub={`${r.employees.length} employé(s)`}
              color="#9333ea" bg="#faf5ff" border="#e9d5ff" />
          </div>

          {/* ── ROW 3: Expenses by category + Trend chart ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

            {/* Expenses breakdown */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>
                🧾 تفصيل المصاريف / Détail des Dépenses
              </div>
              {Object.keys(r.expenses.byCategory).length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Aucune dépense ce mois-ci.</div>
              ) : (
                Object.entries(r.expenses.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => {
                    const { icon, label } = catLabel(cat, lang);
                    const pct = r.expenses.total > 0 ? (amt / r.expenses.total) * 100 : 0;
                    return (
                      <div key={cat} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span>{icon} {label}</span>
                          <span style={{ fontWeight: 600 }}>{fmt(amt)} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                          <div style={{ height: 6, width: `${pct}%`, background: "#f87171", borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Monthly trend */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 4 }}>
                📈 تطور آخر 6 أشهر / Tendance 6 mois
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                {[["#3b82f6","Revenus"],["#f87171","Dépenses"],["#10b981","Profit"]].map(([c,l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                  </div>
                ))}
              </div>
              <MiniBarChart data={r.monthlyTrend} currency={currency} />
              <div style={{ marginTop: 8 }}>
                {r.monthlyTrend.map((m) => (
                  <div key={m.month} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", borderBottom: "1px solid #f8fafc", padding: "4px 0" }}>
                    <span style={{ color: "#94a3b8" }}>{m.month}</span>
                    <span style={{ color: "#3b82f6" }}>+{m.revenue.toLocaleString("fr-DZ")}</span>
                    <span style={{ color: "#f87171" }}>-{m.expenses.toLocaleString("fr-DZ")}</span>
                    <span style={{ color: m.profit >= 0 ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
                      {m.profit >= 0 ? "+" : ""}{m.profit.toLocaleString("fr-DZ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ROW 4: Summary table for employees ── */}
          {r.employees.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>
                👥 رواتب الموظفين / Salaires des Employés
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>الاسم</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>المنصب</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>الراتب / Salaire</th>
                  </tr>
                </thead>
                <tbody>
                  {r.employees.map((emp, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px" }}>{emp.name}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{emp.role}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#7c3aed" }}>{fmt(emp.salary)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#faf5ff" }}>
                    <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700 }}>الإجمالي / Total</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "#7c3aed" }}>{fmt(r.expenses.salaries)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── BOTTOM: Profit Summary ── */}
          <div style={{ background: netPositive ? "#ecfdf5" : "#fffbeb", border: `2px solid ${netPositive ? "#a7f3d0" : "#fde68a"}`, borderRadius: 14, padding: "20px 28px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: netPositive ? "#059669" : "#d97706" }}>
              {netPositive ? "✅" : "⚠️"} ملخص الأرباح / Récapitulatif Financier — {selectedMonth}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, fontSize: 13 }}>
              {[
                ["💵 الإيرادات المحصلة", fmt(r.revenue.collected), "#1d4ed8"],
                ["📉 إجمالي المصاريف", `- ${fmt(r.expenses.total)}`, "#dc2626"],
                ["📢 دخل صافي من الإعلانات", fmt(r.adSpend.margin), "#0e7490"],
                ["🤑 صافي الربح الكلي", fmt(r.profit.net), netPositive ? "#059669" : "#d97706"],
                ["📊 نسبة الربحية", fmtPct(r.profit.margin), netPositive ? "#059669" : "#d97706"],
                ["🏦 الخزينة الكلية", fmt(r.treasury), "#7c3aed"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: "bold", fontSize: 16, color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>لا توجد بيانات لهذا الشهر</div>
      )}
    </div>
  );
}
