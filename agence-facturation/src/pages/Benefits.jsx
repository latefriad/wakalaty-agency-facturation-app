import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { api } from "../services/api";
import toast from "react-hot-toast";
import { Search, Plus, Filter, MoreVertical, Edit2, Trash2, ArrowUpRight, ArrowDownRight, RefreshCcw, Download, Info } from "lucide-react";

// --- Helpers ---
const formatCurrency = (val, currency = "DZD") => {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatPct = (val) => {
  return new Intl.NumberFormat("fr-DZ", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((val || 0) / 100);
};

const STATUS_COLORS = {
  REVENUE: { bg: "#ecfdf5", text: "#059669", icon: <ArrowUpRight size={16} /> },
  EXPENSE: { bg: "#fef2f2", text: "#dc2626", icon: <ArrowDownRight size={16} /> },
  WITHDRAWAL: { bg: "#fffbeb", text: "#d97706", icon: <ArrowDownRight size={16} /> },
  TRANSFER: { bg: "#eff6ff", text: "#2563eb", icon: <RefreshCcw size={16} /> },
};

const CATEGORIES = {
  REVENUE: [
    "Media Buying", "Website Creation", "Branding", "Content Creation",
    "Voice Over", "Marketing Strategy", "Social Media Management", "Other"
  ],
  EXPENSE: [
    // Business
    "Software / SaaS", "Hosting", "Domain", "Advertising", "Freelancer",
    "Transport", "Internet", "Phone", "Equipment", "Office", "Marketing", "Other"
  ],
  WITHDRAWAL: [
    // Personal
    "Food", "Transport", "Shopping", "Family", "Entertainment", "Other"
  ],
  TRANSFER: ["Bank Transfer", "Internal", "Other"]
};

// --- Components ---
function KpiCard({ title, value, type, icon }) {
  let color = "#1e293b";
  if (type === "positive") color = "#059669";
  if (type === "negative") color = "#dc2626";
  if (type === "warning") color = "#d97706";

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: "bold", color }}>
        {value}
      </div>
    </div>
  );
}

function MiniBarChart({ data, currency }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses, d.withdrawals)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "8px 0" }}>
      {data.map((d) => (
        <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90, width: "100%", justifyContent: "center" }}>
            <div title={`Revenus: ${formatCurrency(d.revenue, currency)}`}
              style={{ width: "25%", background: "#10b981", borderRadius: "2px 2px 0 0",
                height: `${Math.round((d.revenue / maxVal) * 90)}px`, minHeight: 2 }} />
            <div title={`Dépenses: ${formatCurrency(d.expenses, currency)}`}
              style={{ width: "25%", background: "#ef4444", borderRadius: "2px 2px 0 0",
                height: `${Math.round((d.expenses / maxVal) * 90)}px`, minHeight: 2 }} />
            <div title={`Retraits: ${formatCurrency(d.withdrawals, currency)}`}
              style={{ width: "25%", background: "#f59e0b", borderRadius: "2px 2px 0 0",
                height: `${Math.round((d.withdrawals / maxVal) * 90)}px`, minHeight: 2 }} />
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
            {d.month.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Benefits() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "ADMIN";

  const [period, setPeriod] = useState("this_month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [form, setForm] = useState({
    type: "REVENUE", amount: "", date: new Date().toISOString().split("T")[0],
    category: "Other", description: "", paymentMethod: "Cash", client: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Table filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/benefits?period=${period}`);
      setData(res.data);
    } catch (err) {
      toast.error(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [period]);

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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      return toast.error("Montant invalide");
    }
    setSubmitting(true);
    try {
      if (editingTx) {
        await api.put(`/benefits/transactions/${editingTx.id}`, form);
        toast.success("Transaction modifiée");
      } else {
        await api.post(`/benefits/transactions`, form);
        toast.success("Transaction ajoutée");
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette transaction ? Le solde et les bénéfices seront affectés.")) return;
    try {
      await api.delete(`/benefits/transactions/${id}`);
      toast.success("Transaction supprimée");
      fetchData();
    } catch (err) {
      toast.error(err.message || "Erreur de suppression");
    }
  };

  const openModal = (tx = null) => {
    if (tx) {
      setEditingTx(tx);
      setForm({
        type: tx.type, amount: tx.amount, date: tx.date.split("T")[0],
        category: tx.category, description: tx.description, paymentMethod: tx.paymentMethod, client: tx.clientName || ""
      });
    } else {
      setEditingTx(null);
      setForm({
        type: "REVENUE", amount: "", date: new Date().toISOString().split("T")[0],
        category: CATEGORIES.REVENUE[0], description: "", paymentMethod: "Cash", client: ""
      });
    }
    setShowModal(true);
  };

  const exportCSV = () => {
    if (!data?.transactions) return;
    const headers = ["Date", "Type", "Catégorie", "Montant", "Client/Source", "Description"];
    const rows = filteredTransactions.map(tx => [
      tx.date.split("T")[0], tx.type, tx.category, tx.amount, tx.clientName || "", tx.description || ""
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.filter(tx => {
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (tx.description?.toLowerCase().includes(s) || 
                tx.category?.toLowerCase().includes(s) || 
                tx.clientName?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [data?.transactions, search, typeFilter]);

  const currency = data?.currency || "DZD";
  const r = data;

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#1e293b", margin: 0 }}>💰 Mes Bénéfices</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, margin: 0 }}>Gérez vos revenus, dépenses et retraits personnels.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", outline: "none", fontSize: 13 }}>
            <option value="today">Aujourd'hui</option>
            <option value="this_week">Cette semaine</option>
            <option value="this_month">Ce mois</option>
            <option value="last_month">Mois précédent</option>
            <option value="this_year">Cette année</option>
          </select>
          <button onClick={fetchData} style={{ padding: "8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
            <RefreshCcw size={16} color="#64748b" />
          </button>
          <button onClick={() => openModal()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Plus size={16} /> Ajouter une transaction
          </button>
        </div>
      </div>

      {/* ERROR / NEGATIVE BALANCE WARNING */}
      {r?.kpis?.availableBalance < 0 && (
        <div style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444", padding: "12px 16px", borderRadius: 8, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, color: "#991b1b" }}>
          <Info size={20} />
          <div>
            <strong>⚠️ Solde négatif :</strong> Votre solde disponible est actuellement de {formatCurrency(r.kpis.availableBalance, currency)}.
          </div>
        </div>
      )}

      {loading && !r ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>⏳ Chargement des données...</div>
      ) : r ? (
        <>
          {/* KPIS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <KpiCard title="Solde disponible" value={formatCurrency(r.kpis.availableBalance, currency)} type={r.kpis.availableBalance >= 0 ? "positive" : "negative"} icon="💰" />
            <KpiCard title="Bénéfices nets" value={formatCurrency(r.kpis.netProfit, currency)} type={r.kpis.netProfit >= 0 ? "positive" : "warning"} icon="📈" />
            <KpiCard title="Revenus" value={formatCurrency(r.kpis.revenues, currency)} type="default" icon="💵" />
            <KpiCard title="Dépenses" value={formatCurrency(r.kpis.expenses, currency)} type="default" icon="💸" />
            <KpiCard title="Retraits personnels" value={formatCurrency(r.kpis.withdrawals, currency)} type="warning" icon="🔄" />
          </div>

          {/* CHARTS ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 16 }}>Évolution (Derniers 6 mois)</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 11, color: "#64748b" }}>
                <span style={{display: "flex", alignItems: "center", gap: 4}}><div style={{width: 10, height: 10, background: "#10b981", borderRadius: 2}}/> Revenus</span>
                <span style={{display: "flex", alignItems: "center", gap: 4}}><div style={{width: 10, height: 10, background: "#ef4444", borderRadius: 2}}/> Dépenses</span>
                <span style={{display: "flex", alignItems: "center", gap: 4}}><div style={{width: 10, height: 10, background: "#f59e0b", borderRadius: 2}}/> Retraits</span>
              </div>
              <MiniBarChart data={r.monthlyTrend} currency={currency} />
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 16 }}>Résumé Mensuel (Derniers 6 mois)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                      <th style={{ textAlign: "left", padding: "8px 0" }}>Mois</th>
                      <th style={{ textAlign: "right", padding: "8px 0" }}>Revenus</th>
                      <th style={{ textAlign: "right", padding: "8px 0" }}>Dépenses</th>
                      <th style={{ textAlign: "right", padding: "8px 0" }}>Bénéfice</th>
                      <th style={{ textAlign: "right", padding: "8px 0" }}>Retraits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.monthlyTrend.slice().reverse().map(m => (
                      <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 0", fontWeight: 500 }}>{m.month}</td>
                        <td style={{ padding: "8px 0", textAlign: "right", color: "#10b981" }}>{formatCurrency(m.revenue)}</td>
                        <td style={{ padding: "8px 0", textAlign: "right", color: "#ef4444" }}>{formatCurrency(m.expenses)}</td>
                        <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{formatCurrency(m.profit)}</td>
                        <td style={{ padding: "8px 0", textAlign: "right", color: "#f59e0b" }}>{formatCurrency(m.withdrawals)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TRANSACTIONS SECTION */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 16 }}>Transactions</div>
              
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px" }}>
                  <Search size={14} color="#94a3b8" />
                  <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, padding: "4px 8px", width: 140 }} />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc" }}>
                  <option value="ALL">Tous les types</option>
                  <option value="REVENUE">Revenus</option>
                  <option value="EXPENSE">Dépenses</option>
                  <option value="WITHDRAWAL">Retraits</option>
                  <option value="TRANSFER">Transferts</option>
                </select>
                <button onClick={exportCSV} title="Exporter CSV"
                  style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Download size={14} color="#64748b" />
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500 }}>Type</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500 }}>Catégorie</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500 }}>Description</th>
                    <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: 500 }}>Montant</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500 }}>Source</th>
                    <th style={{ padding: "12px 20px", textAlign: "center", fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                        <div style={{ marginBottom: 12 }}>Aucune transaction trouvée</div>
                        <button onClick={() => openModal()} style={{ background: "transparent", border: "1px dashed #cbd5e1", padding: "8px 16px", borderRadius: 8, color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}>
                          + Ajouter une transaction
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 20px", color: "#475569" }}>{tx.date.split("T")[0]}</td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[tx.type].bg, color: STATUS_COLORS[tx.type].text }}>
                            {STATUS_COLORS[tx.type].icon}
                            {tx.type === "WITHDRAWAL" ? "Retrait" : tx.type}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px", color: "#1e293b", fontWeight: 500 }}>{tx.category}</td>
                        <td style={{ padding: "12px 20px", color: "#64748b", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || "-"}</td>
                        <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: "bold", color: STATUS_COLORS[tx.type].text }}>
                          {tx.type === "EXPENSE" || tx.type === "WITHDRAWAL" ? "-" : "+"}{formatCurrency(tx.amount, currency)}
                        </td>
                        <td style={{ padding: "12px 20px", color: "#64748b", fontSize: 12 }}>
                          {tx.clientName || "-"}
                        </td>
                        <td style={{ padding: "12px 20px", textAlign: "center" }}>
                          {tx.isEditable ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button onClick={() => openModal(tx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6" }}><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete(tx.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={16} /></button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>Auto</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* MODAL AJOUT/EDIT */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 500, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>{editingTx ? "Modifier la transaction" : "Ajouter une transaction"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>&times;</button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Type</label>
                  <select value={form.type} onChange={e => {
                      const newType = e.target.value;
                      setForm({...form, type: newType, category: CATEGORIES[newType][0]});
                    }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", background: "#fff" }}>
                    <option value="REVENUE">Revenue (Entrée)</option>
                    <option value="EXPENSE">Dépense Business</option>
                    <option value="WITHDRAWAL">Retrait Personnel</option>
                    <option value="TRANSFER">Transfert</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Montant (DA)</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box", fontSize: 16, fontWeight: "bold" }} placeholder="0.00" />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Catégorie</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", background: "#fff" }}>
                  {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Description / Note</label>
                <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} placeholder="Détails de la transaction..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Méthode de paiement</label>
                  <select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", background: "#fff" }}>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Banque</option>
                    <option value="CCP">CCP</option>
                    <option value="BaridiMob">BaridiMob</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Source / Client (Optionnel)</label>
                  <input type="text" value={form.client} onChange={e => setForm({...form, client: e.target.value})}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} placeholder="Nom du client..." />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#3b82f6", fontWeight: 600, color: "#fff", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
