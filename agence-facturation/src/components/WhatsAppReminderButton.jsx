import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";

/**
 * Normalizes an Algerian (or international) phone number to international wa.me format
 * e.g.:
 *  "0550 12 34 56" -> "213550123456"
 *  "+213 661 23 45 67" -> "213661234567"
 *  "0770123456" -> "213770123456"
 */
export function normalizePhoneNumber(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Algerian local format starting with 0 (e.g. 05, 06, 07, 02...)
  if (digits.startsWith("0") && digits.length === 10) {
    return "213" + digits.slice(1);
  }
  return digits;
}

export default function WhatsAppReminderButton({ invoice }) {
  const { agency } = useAuth();
  const { t, lang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedLang, setSelectedLang] = useState("ar");
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Only show for unpaid invoices (skip drafts and quotes unless finalized invoice)
  if (!invoice || invoice.docType === "DEVIS" || invoice.status === "PAYEE" || invoice.status === "ANNULEE") {
    return null;
  }

  const clientName = invoice.client?.name || t("dash.client");
  const invoiceNumber = invoice.number || "";
  const remainingAmount = Number(invoice.balance ?? invoice.total ?? 0).toLocaleString("fr-DZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = invoice.currency || "DZD";
  const agencyName = agency?.name || "Adpowers Digital";

  const formattedDueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("fr-DZ")
    : null;

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();

  // Template generators
  const templates = useMemo(() => {
    const dueStrAr = formattedDueDate
      ? isOverdue
        ? `(وكان تاريخ استحقاقها: ${formattedDueDate} ⚠️)`
        : `(تاريخ الاستحقاق: ${formattedDueDate})`
      : "";

    const dueStrFr = formattedDueDate
      ? isOverdue
        ? `(échéance dépassée le : ${formattedDueDate} ⚠️)`
        : `(échéance le : ${formattedDueDate})`
      : "";

    const dueStrEn = formattedDueDate
      ? isOverdue
        ? `(overdue since: ${formattedDueDate} ⚠️)`
        : `(due on: ${formattedDueDate})`
      : "";

    return {
      ar: `السلام عليكم ورحمة الله وبركاته،\nالأفاضل في ${clientName}،\n\nنود تذكيركم بلطف بأن الفاتورة رقم ${invoiceNumber} بمبلغ ${remainingAmount} ${currency} مستحقة الدفع ${dueStrAr}.\n\nيرجى التكرم بتسوية المستحقات وموافاتنا بإشعار التحويل عند إتمامه.\nشاكرين لكم حسن تعاونكم الدائم.\n\nتحياتنا،\nفريق ${agencyName}`,
      fr: `Bonjour ${clientName},\n\nNous vous rappelons que la facture N° ${invoiceNumber} d'un montant de ${remainingAmount} ${currency} est en attente de règlement ${dueStrFr}.\n\nMerci de bien vouloir procéder au règlement et nous transmettre l'avis de virement dès réalisation.\n\nCordialement,\nL'équipe ${agencyName}`,
      en: `Hello ${clientName},\n\nThis is a friendly reminder that invoice #${invoiceNumber} for ${remainingAmount} ${currency} is currently pending payment ${dueStrEn}.\n\nPlease let us know once the transfer is completed. Thank you for your continued trust!\n\nBest regards,\n${agencyName} Team`,
    };
  }, [clientName, invoiceNumber, remainingAmount, currency, formattedDueDate, isOverdue, agencyName]);

  const handleOpenModal = () => {
    const initialPhone = invoice.client?.phone || "";
    setPhone(initialPhone);
    const initialLang = lang === "fr" ? "fr" : lang === "en" ? "en" : "ar";
    setSelectedLang(initialLang);
    setCustomText(templates[initialLang]);
    setPhoneError("");
    setCopied(false);
    setIsOpen(true);
  };

  const handleLangChange = (newLang) => {
    setSelectedLang(newLang);
    setCustomText(templates[newLang]);
  };

  const handleSendWhatsApp = () => {
    const clean = normalizePhoneNumber(phone);
    if (!clean || clean.length < 8) {
      setPhoneError(t("inv.whatsappInvalidPhone"));
      return;
    }
    setPhoneError("");
    const encoded = encodeURIComponent(customText);
    const url = `https://wa.me/${clean}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const normalizedPreview = normalizePhoneNumber(phone);

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        title={t("inv.whatsappReminder")}
        style={{
          padding: "6px 11px",
          borderRadius: 8,
          border: "1px solid #86efac",
          background: "#f0fdf4",
          color: "#15803d",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#dcfce7")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#f0fdf4")}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        <span>{t("inv.whatsappReminder")}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 540,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              direction: lang === "ar" ? "rtl" : "ltr",
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#25D366",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 20,
                  }}
                >
                  💬
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                    {t("inv.whatsappModalTitle")}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {clientName} • {invoiceNumber} • {remainingAmount} {currency}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Overdue Warning Badge if applicable */}
            {isOverdue && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "#dc2626",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>⚠️</span>
                <span>
                  {lang === "ar"
                    ? `هذه الفاتورة متأخرة عن موعد الاستحقاق (${formattedDueDate})`
                    : `Cette facture est en retard de paiement (${formattedDueDate})`}
                </span>
              </div>
            )}

            {/* Phone Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                {t("inv.whatsappPhone")}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError("");
                  }}
                  placeholder="0550 12 34 56 / 06... / 07..."
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: phoneError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                    fontSize: 14,
                    outline: "none",
                    direction: "ltr",
                  }}
                />
              </div>
              {normalizedPreview && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, direction: "ltr" }}>
                  wa.me/<b>+{normalizedPreview}</b>
                </div>
              )}
              {phoneError && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                  {phoneError}
                </div>
              )}
            </div>

            {/* Language Tabs */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "ar", label: "🇩🇿 العربية" },
                  { id: "fr", label: "🇫🇷 Français" },
                  { id: "en", label: "🇬🇧 English" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleLangChange(item.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedLang === item.id ? "1px solid #2563eb" : "1px solid #e2e8f0",
                      background: selectedLang === item.id ? "#eff6ff" : "#f8fafc",
                      color: selectedLang === item.id ? "#1d4ed8" : "#475569",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Textarea */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                {t("inv.whatsappMessage")}
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={7}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  lineHeight: 1.6,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  resize: "vertical",
                  direction: selectedLang === "ar" ? "rtl" : "ltr",
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{copied ? "✓" : "📋"}</span>
                <span>{copied ? t("inv.whatsappCopied") : t("inv.whatsappCopy")}</span>
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel") || "إلغاء"}
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#25D366",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 4px rgba(37, 211, 102, 0.3)",
                  }}
                >
                  <span>💬</span>
                  <span>{t("inv.whatsappSend")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
