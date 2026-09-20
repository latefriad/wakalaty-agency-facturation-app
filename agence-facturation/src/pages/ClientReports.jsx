import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const MONTH_NAMES_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function ClientReports() {
  const { t, lang: currentAppLang } = useLang();
  const { agency } = useAuth();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [reportLang, setReportLang] = useState("ar"); // 'ar' | 'fr'
  const [agencyNotes, setAgencyNotes] = useState("");

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const reportRef = useRef(null);

  // Load clients on mount
  useEffect(() => {
    api
      .get("/clients")
      .then((res) => {
        const list = res.data || [];
        setClients(list);
        if (list.length > 0 && !selectedClientId) {
          setSelectedClientId(list[0].id);
        }
      })
      .catch((err) => toast.error(err.message));
  }, [selectedClientId]);

  // Load report data
  const fetchReport = useCallback(async () => {
    if (!selectedClientId) return;
    setLoading(true);
    try {
      const res = await api.get(`/client-reports/${selectedClientId}?month=${selectedMonth}`);
      setReportData(res.data);

      // Initialize default notes if empty
      if (!agencyNotes) {
        if (reportLang === "ar") {
          setAgencyNotes(
            "بناءً على أداء الشهر الحالي، تم تسجيل نتائج إيجابية في الحملات الإعلانية ومعدل التحصيل. نوصي بمضاعفة ميزانية المنتجات الرابحة ومواصلة تحسين صفحات الهبوط لتحقيق أعلى عائد على الاستثمار."
          );
        } else {
          setAgencyNotes(
            "Au vu des résultats de ce mois, les performances d'acquisition restent satisfaisantes avec un ROAS positif. Nous recommandons de concentrer les budgets sur les campagnes validées et d'optimiser le tunnel de conversion."
          );
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedMonth, reportLang, agencyNotes]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Update default notes when report language toggles (if notes haven't been heavily customized)
  const handleLangToggle = (newLang) => {
    setReportLang(newLang);
    if (newLang === "ar") {
      setAgencyNotes(
        "بناءً على أداء الشهر الحالي، تم تسجيل نتائج إيجابية في الحملات الإعلانية ومعدل التحصيل. نوصي بمضاعفة ميزانية المنتجات الرابحة ومواصلة تحسين صفحات الهبوط لتحقيق أعلى عائد على الاستثمار."
      );
    } else {
      setAgencyNotes(
        "Au vu des résultats de ce mois, les performances d'acquisition restent satisfaisantes avec un ROAS positif. Nous recommandons de concentrer les budgets sur les campagnes validées et d'optimiser le tunnel de conversion."
      );
    }
  };

  // Download PDF using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!reportRef.current || !reportData) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let position = 0;
      let remaining = imgHeight;
      pdf.addImage(img, "PNG", 0, position, pageWidth, imgHeight);
      remaining -= pageHeight;
      while (remaining > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, position, pageWidth, imgHeight);
        remaining -= pageHeight;
      }

      const clientNameClean = (reportData.client?.name || "client").replace(/\s+/g, "_");
      pdf.save(`Rapport_${clientNameClean}_${selectedMonth}.pdf`);
      toast.success(t("common.saved") || "PDF téléchargé avec succès");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(false);
    }
  };

  const isRTL = reportLang === "ar";
  const fmt = (n) => (n ?? 0).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
  const cur = reportLang === "ar" ? "دج" : "DZD";

  // Format month label
  const getFormattedMonth = () => {
    if (!selectedMonth) return "";
    const [y, m] = selectedMonth.split("-");
    const monthIdx = parseInt(m, 10) - 1;
    if (reportLang === "ar") {
      return `${MONTH_NAMES_AR[monthIdx] || m} ${y}`;
    }
    return `${MONTH_NAMES_FR[monthIdx] || m} ${y}`;
  };

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📑</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              {t("clientReport.title")}
            </h1>
          </div>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            {t("clientReport.subtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            🖨️ {t("common.print") || "Imprimer"}
          </button>
          <button
            type="button"
            disabled={downloading || !reportData}
            onClick={handleDownloadPDF}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: downloading ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⬇️</span> {downloading ? t("clientReport.generating") : t("clientReport.downloadPDF")}
          </button>
        </div>
      </div>

      {/* Control Panel (Client, Month, Lang, Notes) */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 18,
          border: "1px solid #e2e8f0",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          {/* Select Client */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#475569" }}>
              👥 {t("clientReport.selectClient")}
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                background: "#fff",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Select Month */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#475569" }}>
              🗓️ {t("clientReport.selectMonth")}
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Select Report Language */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#475569" }}>
              🌐 {t("clientReport.reportLanguage")}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleLangToggle("ar")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: reportLang === "ar" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  background: reportLang === "ar" ? "#eff6ff" : "#fff",
                  color: reportLang === "ar" ? "#1d4ed8" : "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                العربية (RTL)
              </button>
              <button
                type="button"
                onClick={() => handleLangToggle("fr")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: reportLang === "fr" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  background: reportLang === "fr" ? "#eff6ff" : "#fff",
                  color: reportLang === "fr" ? "#1d4ed8" : "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Français (LTR)
              </button>
            </div>
          </div>
        </div>

        {/* Agency Notes Textarea */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#475569" }}>
            ✍️ {t("clientReport.agencyNotes")}
          </label>
          <textarea
            rows={2}
            value={agencyNotes}
            onChange={(e) => setAgencyNotes(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              boxSizing: "border-box",
              direction: isRTL ? "rtl" : "ltr",
            }}
          />
        </div>
      </div>

      {/* Live Report Preview Container */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>
          ⏳ {t("common.loading")}...
        </div>
      ) : !reportData ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
          {t("clientReport.noClientSelected")}
        </div>
      ) : (
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
          }}
        >
          {/* ═══════════════ EXPORTABLE REPORT CANVAS ═══════════════ */}
          <div
            ref={reportRef}
            dir={isRTL ? "rtl" : "ltr"}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              padding: "40px 45px",
              fontFamily: isRTL
                ? "'Segoe UI', Tahoma, 'Arial', sans-serif"
                : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              minHeight: 1100,
              boxSizing: "border-box",
            }}
          >
            {/* Header with Agency Branding & Executive Style */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: 24,
                borderBottom: "2px solid #0f172a",
                marginBottom: 24,
                gap: 20,
              }}
            >
              {/* Agency Brand & Coordinates */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {reportData.agency?.logo ? (
                    <img
                      src={reportData.agency.logo}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: "#0f172a",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        fontWeight: 700,
                      }}
                    >
                      ⚡
                    </div>
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                      {reportData.agency?.name || "Adpowers Digital"}
                    </h2>
                    <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>
                      {isRTL ? "وكالة نمو وتسويق رقمي" : "Agence de Croissance & Acquisition"}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                  {reportData.agency?.phone && <div>📞 {reportData.agency.phone}</div>}
                  {reportData.agency?.email && <div>✉️ {reportData.agency.email}</div>}
                  {reportData.agency?.website && <div>🌐 {reportData.agency.website}</div>}
                </div>
              </div>

              {/* Document Title & Period Badge */}
              <div style={{ textAlign: isRTL ? "left" : "right" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 6,
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  {isRTL ? "تقرير الأداء الشهري" : "RAPPORT D'ACTIVITÉ MENSUEL"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb" }}>
                  {getFormattedMonth()}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {isRTL ? "تاريخ الإصدار:" : "Émis le :"} {new Date().toLocaleDateString(isRTL ? "ar-DZ" : "fr-FR")}
                </div>
              </div>
            </div>

            {/* Client Info Banner */}
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: "16px 20px",
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 28,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                  {isRTL ? "تقرير نشاط العميل" : "CLIENT BÉNÉFICIAIRE"}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                  {reportData.client?.name}
                </div>
                {reportData.client?.company && (
                  <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600 }}>
                    {reportData.client.company}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, textAlign: isRTL ? "left" : "right" }}>
                {reportData.client?.phone && <div>📱 {reportData.client.phone}</div>}
                {reportData.client?.email && <div>✉️ {reportData.client.email}</div>}
                {reportData.client?.address && <div>📍 {reportData.client.address}</div>}
              </div>
            </div>

            {/* ═══════════════ SECTION 1: FINANCIALS ═══════════════ */}
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "2px solid #e2e8f0",
                  paddingBottom: 6,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 16 }}>💰</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                  {isRTL ? "1. الملخص المالي والفوترة" : "1. Synthèse Financière & Facturation"}
                </h3>
              </div>

              {/* 3 Metric cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {isRTL ? "إجمالي الفواتير الصادرة هذا الشهر" : "Total Facturé ce mois"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb", marginTop: 2 }}>
                    {fmt(reportData.financials?.totalInvoiced)} {cur}
                  </div>
                </div>

                <div style={{ background: "#f0fdf4", padding: "12px 14px", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: 11, color: "#166534" }}>
                    {isRTL ? "المبالغ المحصلة / المدفوعة" : "Paiements Encaissés"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", marginTop: 2 }}>
                    {fmt(reportData.financials?.totalPaid)} {cur}
                  </div>
                </div>

                <div style={{ background: "#fffbeb", padding: "12px 14px", borderRadius: 8, border: "1px solid #fef08a" }}>
                  <div style={{ fontSize: 11, color: "#854d0e" }}>
                    {isRTL ? "المستحقات المتبقية في الذمة" : "Solde restant dû"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#d97706", marginTop: 2 }}>
                    {fmt(reportData.financials?.totalOutstanding)} {cur}
                  </div>
                </div>
              </div>

              {/* Invoices table if any */}
              {reportData.financials?.invoices?.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "رقم الفاتورة" : "N° Facture"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "التاريخ" : "Date"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "الحالة" : "Statut"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>{isRTL ? "المبلغ" : "Montant"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.financials.invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: "#0f172a" }}>{inv.number}</td>
                        <td style={{ padding: "6px 10px", color: "#64748b" }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: "6px 10px" }}>{inv.status}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end", fontWeight: 700 }}>
                          {fmt(inv.total)} {inv.currency || cur}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ═══════════════ SECTION 2: AD SPEND (MODULE 3) ═══════════════ */}
            {reportData.adSpend?.entries?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: 6,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📈</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                    {isRTL ? "2. أداء الحملات الإعلانية (Media Buying)" : "2. Performance des Campagnes Publicitaires"}
                  </h3>
                </div>

                {/* Ad KPI Cards */}
                {reportData.adSpend?.summary && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ background: "#eff6ff", padding: "10px 12px", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                      <div style={{ fontSize: 10, color: "#1e40af" }}>{isRTL ? "المصروف الإعلاني" : "Budget Dépensé"}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}>
                        {fmt(reportData.adSpend.summary.totalSpend)} {cur}
                      </div>
                    </div>

                    <div style={{ background: "#fdf2f8", padding: "10px 12px", borderRadius: 8, border: "1px solid #fbcfe8" }}>
                      <div style={{ fontSize: 10, color: "#9d174d" }}>{isRTL ? "الطلبات المحققة" : "Commandes"}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#be185d" }}>
                        {reportData.adSpend.summary.totalOrders}
                      </div>
                    </div>

                    <div style={{ background: "#ecfdf5", padding: "10px 12px", borderRadius: 8, border: "1px solid #a7f3d0" }}>
                      <div style={{ fontSize: 10, color: "#065f46" }}>{isRTL ? "معدل العائد (ROAS)" : "ROAS Moyen"}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>
                        {reportData.adSpend.summary.avgROAS}x
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, color: "#475569" }}>{isRTL ? "تكلفة الطلب (CPA)" : "CPA Moyen"}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                        {fmt(reportData.adSpend.summary.avgCPA)} {cur}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ad Entries Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "المنصة / الحملة" : "Plateforme / Campagne"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>{isRTL ? "المصروف" : "Dépense"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>{isRTL ? "الطلبات" : "Ordres"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>CPA</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.adSpend.entries.map((e) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{e.platform}</span>
                          {e.campaignName && (
                            <span style={{ color: "#64748b", marginInlineStart: 6 }}>
                              ({e.campaignName})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "end", fontWeight: 600 }}>{fmt(e.actualSpend)} {cur}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end" }}>{e.orders}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end" }}>{fmt(e.cpa)} {cur}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end", fontWeight: 700, color: e.roas >= 2.5 ? "#16a34a" : "#0f172a" }}>
                          {e.roas}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ═══════════════ SECTION 3: TESTILI PRODUCT TESTS (MODULE 5) ═══════════════ */}
            {reportData.testili?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: 6,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🧪</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                    {isRTL ? "3. نتائج اختبار المنتجات (مختبر Testili)" : "3. Tests Produits & Validation (Testili)"}
                  </h3>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "اسم المنتج" : "Produit Testé"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "start" }}>{isRTL ? "المنصة" : "Plateforme"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>{isRTL ? "المصروف" : "Dépensé"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>{isRTL ? "الطلبات" : "Commandes"}</th>
                      <th style={{ padding: "6px 10px", textAlign: "end" }}>ROAS</th>
                      <th style={{ padding: "6px 10px", textAlign: "center" }}>{isRTL ? "النتيجة" : "Verdict"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.testili.map((tst) => (
                      <tr key={tst.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: "#0f172a" }}>{tst.productName}</td>
                        <td style={{ padding: "6px 10px" }}>{tst.platform}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end" }}>{fmt(tst.amountSpent)} {cur}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end" }}>{tst.orders}</td>
                        <td style={{ padding: "6px 10px", textAlign: "end", fontWeight: 600 }}>{tst.actualROAS != null ? `${tst.actualROAS}x` : "—"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 700,
                              background:
                                tst.verdict === "WINNER"
                                  ? "#dcfce7"
                                  : tst.verdict === "LOSER"
                                  ? "#fee2e2"
                                  : "#f1f5f9",
                              color:
                                tst.verdict === "WINNER"
                                  ? "#16a34a"
                                  : tst.verdict === "LOSER"
                                  ? "#dc2626"
                                  : "#475569",
                            }}
                          >
                            {tst.verdict}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ═══════════════ SECTION 4: COMPLETED DELIVERABLES / TASKS ═══════════════ */}
            {reportData.tasks?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: 6,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📋</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                    {isRTL ? "4. المهام والخدمات المنفذة" : "4. Livrables & Prestations Réalisées"}
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {reportData.tasks.map((tsk) => (
                    <div
                      key={tsk.id}
                      style={{
                        padding: "8px 12px",
                        background: "#f8fafc",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{tsk.title}</span>
                      </div>
                      <span style={{ color: "#94a3b8" }}>
                        {new Date(tsk.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════ SECTION 5: AGENCY RECOMMENDATIONS & CONCLUSION ═══════════════ */}
            <div style={{ marginBottom: 36 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "2px solid #e2e8f0",
                  paddingBottom: 6,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 16 }}>💡</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                  {isRTL ? "5. ملاحظات وتوصيات الوكالة" : "5. Recommandations & Conclusion de l'Agence"}
                </h3>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: "14px 18px",
                  borderInlineStart: "4px solid #2563eb",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "#1e293b",
                }}
              >
                {agencyNotes}
              </div>
            </div>

            {/* ═══════════════ FOOTER & SIGNATURE SECTION ═══════════════ */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                paddingTop: 20,
                borderTop: "1px solid #e2e8f0",
                marginTop: "auto",
              }}
            >
              <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
                {reportData.agency?.nif && <span>NIF: {reportData.agency.nif} • </span>}
                {reportData.agency?.rc && <span>RC: {reportData.agency.rc} • </span>}
                {reportData.agency?.rib && <div>RIB: {reportData.agency.rib} ({reportData.agency.bankName || ""})</div>}
                <div>Document officiel généré par la plateforme Wakalati pour Adpowers Digital</div>
              </div>

              <div style={{ textAlign: "center", minWidth: 160 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 40 }}>
                  {isRTL ? "ختم وتوقيع الوكالة" : "Cachet & Signature de l'Agence"}
                </div>
                <div style={{ borderTop: "1px dashed #cbd5e1", width: 140, margin: "0 auto" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
