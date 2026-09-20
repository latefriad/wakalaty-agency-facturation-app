import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";
import { renderInvoiceContent, normalizeInvoice } from "../components/InvoiceTemplates";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

// Portail client light : le destinataire consulte/télécharge sa facture via
// le lien reçu par e-mail, sans compte. Lecture seule, endpoint public.
export default function PublicInvoice() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/invoices/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Document introuvable");
        setDoc(json.data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [token]);

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: "#fff" });
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, (canvas.height * w) / canvas.width);
      pdf.save(`${doc.number}.pdf`);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',Tahoma,sans-serif", background: "#f8fafc" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <h2 style={{ color: "#334155" }}>Document introuvable</h2>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Le lien est peut-être expiré ou incorrect.</p>
      </div>
    );
  }

  if (!doc) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Chargement…</div>;
  }

  const vm = normalizeInvoice(doc, doc.agency);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 12px", fontFamily: "'Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, color: "#334155" }}>
            {doc.agency?.name} — {vm.docLabel} {vm.invoiceNumber}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              {downloading ? "..." : "⬇️ PDF"}
            </button>
            <button
              onClick={() => window.print()}
              style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              🖨️ Imprimer
            </button>
          </div>
        </div>

        {doc.balance > 0 && doc.paidAmount > 0 && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 14 }}>
            Payé : {doc.paidAmount.toFixed(2)} — Restant dû : {doc.balance.toFixed(2)} {doc.agency?.currency || "DZD"}
          </div>
        )}

        <div
          ref={previewRef}
          style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", direction: "rtl" }}
          dangerouslySetInnerHTML={{ __html: renderInvoiceContent(vm, "classic") }}
        />
      </div>
    </div>
  );
}
