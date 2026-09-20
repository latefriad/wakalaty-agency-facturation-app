import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { TEMPLATES, renderInvoiceContent, normalizeInvoice } from "./InvoiceTemplates";

export default function InvoicePDF({ invoice, onClose }) {
  const { agency } = useAuth();
  const { t } = useLang();
  const [templateId, setTemplateId] = useState(invoice?.template || "classic");
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef(null);

  if (!invoice) return null;

  const vm = normalizeInvoice(invoice, agency);
  const html = renderInvoiceContent(vm, templateId);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8"/>
          <title>${vm.docLabel} ${vm.invoiceNumber}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; color:#1e293b; }
            @media print { body { padding:0; } }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 1200);
  };

  // Vrai fichier .pdf téléchargeable (jspdf + html2canvas), généré depuis
  // l'aperçu affiché — pas de dépendance serveur.
  const handleDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(previewRef.current, {
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
      pdf.save(`${vm.invoiceNumber || "facture"}.pdf`);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert(t("inv.pdfError"));
    } finally {
      setDownloading(false);
    }
  };

  const btnStyle = {
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 700,
          maxHeight: "90vh",
          overflowY: "auto",
          direction: "rtl",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 10,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {t("inv.preview")} {vm.docLabel} {vm.invoiceNumber}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 13,
                outline: "none",
                background: "#fff",
              }}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{ ...btnStyle, background: "#10b981", color: "#fff", opacity: downloading ? 0.7 : 1 }}
            >
              {downloading ? "..." : t("inv.download")}
            </button>
            <button onClick={handlePrint} style={{ ...btnStyle, background: "#3b82f6", color: "#fff" }}>
              {t("inv.print")}
            </button>
            <button onClick={onClose} style={{ ...btnStyle, background: "#f1f5f9", fontWeight: 400 }}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div
          ref={previewRef}
          style={{ background: "#fff" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
