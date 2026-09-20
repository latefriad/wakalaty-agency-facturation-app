// Libellés bilingues arabe / français pour les documents commerciaux Adpowers Digital
const STATUS = {
  EN_ATTENTE: { ar: "في الانتظار", fr: "En attente", color: "#f59e0b", bg: "#fef3c7" },
  SENT:       { ar: "مُرسَلة", fr: "Envoyée", color: "#0284c7", bg: "#e0f2fe" },
  VUE:        { ar: "تمت المعاينة", fr: "Vue", color: "#6366f1", bg: "#e0e7ff" },
  DRAFT:      { ar: "مسودة", fr: "Brouillon", color: "#64748b", bg: "#f1f5f9" },
  PAYEE:      { ar: "مدفوعة بالكامل", fr: "Payée", color: "#16a34a", bg: "#dcfce7" },
  ANNULEE:    { ar: "ملغاة", fr: "Annulée", color: "#dc2626", bg: "#fee2e2" },
  EN_RETARD:  { ar: "متأخرة عن الدفع", fr: "En retard", color: "#b91c1c", bg: "#fef2f2" },
  en_attente: { ar: "في الانتظار", fr: "En attente", color: "#f59e0b", bg: "#fef3c7" },
  payée:      { ar: "مدفوعة", fr: "Payée", color: "#16a34a", bg: "#dcfce7" },
  annulée:    { ar: "ملغاة", fr: "Annulée", color: "#dc2626", bg: "#fee2e2" },
};

const CURRENCY_SYMBOL = { DZD: "دج", EUR: "€", USD: "$" };
function currencySymbol(code) {
  if (!code || code === "DZD") return "دج";
  return CURRENCY_SYMBOL[code] || code;
}

export function normalizeInvoice(raw, agency) {
  const items = raw.items || raw.services || [];
  const services = items.map((i) => ({
    name: i.description || i.name || "",
    qty: i.quantity ?? 1,
    unitPrice: i.unitPrice ?? null,
    price: i.total ?? i.price ?? (i.quantity || 1) * (i.unitPrice || 0),
  }));
  const subtotal = raw.subtotal ?? services.reduce((s, x) => s + (parseFloat(x.price) || 0), 0);
  const taxAmount = raw.taxAmount ?? (subtotal * (raw.tax || 0)) / 100;
  const currency = currencySymbol(raw.currency || agency?.currency);
  const primary = agency?.primaryColor || "#2563eb";
  const secondary = agency?.secondaryColor || "#0f172a";

  return {
    invoiceNumber: raw.number || raw.invoiceNumber || "FAC-" + (new Date().getFullYear()),
    docLabel: raw.docType === "DEVIS" ? "عرض سعر" : "فاتورة تجارية",
    docLabelFr: raw.docType === "DEVIS" ? "Devis Professionnel" : "Facture Officielle",
    isQuote: raw.docType === "DEVIS",
    clientName: raw.client?.name || raw.clientName || "Client Partenaire",
    clientCompany: raw.client?.company || "",
    clientPhone: raw.client?.phone || "",
    clientEmail: raw.client?.email || "",
    clientAddress: raw.client?.address || "",
    agencyName: agency?.name || "Adpowers Digital",
    agencyTagline: agency?.tagline || "Agence de Croissance · Media Buying, Web & Vidéo",
    agencyLogo: agency?.logo || null,
    agencyAddress: agency?.address || "Alger, Algérie",
    agencyPhone: agency?.phone || "+213 779 41 12 91",
    agencyEmail: agency?.email || "contact@adpowersdigital.com",
    agencyWebsite: agency?.website || "https://adpowersdigital.netlify.app",
    agencyTaxId: agency?.taxId || "",
    agencyBank: agency?.bankAccount || "",
    primary,
    secondary,
    status: raw.displayStatus || raw.status || "EN_ATTENTE",
    dueDate: raw.dueDate ? new Date(raw.dueDate).toLocaleDateString("fr-DZ") : null,
    issueDate: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString("fr-DZ") : new Date().toLocaleDateString("fr-DZ"),
    services,
    subtotal,
    tax: raw.tax || 0,
    taxAmount,
    discount: raw.discount || 0,
    deposit: raw.depositAmount || 0,
    penalty: raw.penaltyAmount || 0,
    total: raw.total ?? (subtotal + taxAmount - (raw.discount || 0)),
    balance: raw.balance,
    paidAmount: raw.paidAmount,
    notes: raw.notes,
    currency,
  };
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bi(ar, fr, { color = "#64748b", size = 11 } = {}) {
  return `${esc(ar)} <span style="font-size:${size}px;color:${color};font-weight:400">(${esc(fr)})</span>`;
}

function statusBadge(invoice) {
  const st = STATUS[invoice.status] || STATUS.EN_ATTENTE;
  return `<span style="background:${st.bg};color:${st.color};border:1px solid ${st.color}40;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px">
    <span>${esc(st.ar)}</span>
    <span style="font-size:10px;opacity:0.8">· ${esc(st.fr)}</span>
  </span>`;
}

function totalsBlock(invoice, accent = "#2563eb") {
  const c = invoice.currency;
  const row = (labelAr, labelFr, value, opts = {}) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:13px${opts.strong ? ";font-weight:700" : ""};border-bottom:1px dashed #e2e8f0">
      <span style="color:${opts.color || "#475569"}">${bi(labelAr, labelFr, { color: "#94a3b8" })}</span>
      <span style="color:${opts.color || "#0f172a"};font-weight:${opts.strong ? 700 : 600}">${value.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} ${c}</span>
    </div>`;

  return `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 22px;max-width:380px;margin-inline-start:auto;box-shadow:0 2px 8px rgba(0,0,0,0.03)">
      ${row("المجموع الجزئي", "Sous-total HT", invoice.subtotal || 0)}
      ${invoice.discount ? row("الخصم الترويجي", "Remise", -invoice.discount, { color: "#16a34a" }) : ""}
      ${invoice.tax ? row(`الضريبة الرسمية (${invoice.tax}%)`, "TVA", invoice.taxAmount || 0) : ""}
      
      <div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg, ${accent}10 0%, ${accent}25 100%);border:1px solid ${accent}40;border-radius:10px;padding:12px 16px;margin:12px 0 6px">
        <span style="font-weight:800;font-size:15px;color:${accent}">${bi("المجموع الكلي", "Total TTC", { color: accent, size: 12 })}</span>
        <span style="font-weight:900;font-size:20px;color:${accent}">${(invoice.total || 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} ${c}</span>
      </div>

      ${invoice.deposit ? row("العربون المطلوب", "Acompte à verser", invoice.deposit, { strong: true, color: "#d97706" }) : ""}
      ${invoice.penalty ? row("غرامة التأخير", "Pénalité de retard", invoice.penalty, { color: "#dc2626" }) : ""}
      ${(invoice.deposit || invoice.penalty) ? `
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:14px;color:#dc2626;padding-top:8px">
          <span>${bi("المبلغ المستحق للدفع", "Net à payer", { color: "#dc2626" })}</span>
          <span>${((invoice.total || 0) + invoice.penalty - (invoice.paidAmount || 0)).toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} ${c}</span>
        </div>
      ` : ""}
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE 1: ADPOWERS EXECUTIVE (New Default Agency Template)
// ─────────────────────────────────────────────────────────────
function renderExecutive(invoice) {
  const accent = invoice.primary || "#2563eb";
  const dark = invoice.secondary || "#0f172a";

  return `
    <div style="padding:0;background:#ffffff;font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;line-height:1.5">
      <!-- Top Brand Bar -->
      <div style="background:linear-gradient(135deg, ${dark} 0%, #1e293b 100%);color:#fff;padding:36px 44px;position:relative;border-bottom:4px solid ${accent}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:20px">
          <!-- Agency Brand -->
          <div>
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:48px;height:48px;border-radius:12px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;box-shadow:0 4px 14px rgba(37,99,235,0.4)">
                ⚡
              </div>
              <div>
                <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin:0;color:#ffffff">${esc(invoice.agencyName)}</h1>
                <p style="font-size:12px;color:#94a3b8;margin:3px 0 0;font-weight:500">${esc(invoice.agencyTagline)}</p>
              </div>
            </div>
            <div style="margin-top:14px;font-size:11px;color:#cbd5e1;display:flex;gap:16px;flex-wrap:wrap">
              <span>🌐 ${esc(invoice.agencyWebsite)}</span>
              <span>📱 ${esc(invoice.agencyPhone)}</span>
              <span>✉️ ${esc(invoice.agencyEmail)}</span>
            </div>
          </div>

          <!-- Document Tag -->
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.01em">
              ${esc(invoice.docLabel)}
            </div>
            <div style="font-size:12px;color:#94a3b8;font-weight:500;margin-top:2px">
              ${esc(invoice.docLabelFr)}
            </div>
            <div style="font-size:15px;font-weight:800;color:#60a5fa;margin-top:6px;font-family:monospace;letter-spacing:0.5px">
              ${esc(invoice.invoiceNumber)}
            </div>
            <div style="margin-top:10px">
              ${statusBadge(invoice)}
            </div>
          </div>
        </div>
      </div>

      <div style="padding:36px 44px">
        <!-- Client & Meta Cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
          <!-- Client Card -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">
              ${bi("معلومات العميل", "Destinataire / Client")}
            </div>
            <div style="font-size:17px;font-weight:800;color:#0f172a">${esc(invoice.clientName)}</div>
            ${invoice.clientCompany ? `<div style="font-size:13px;color:#3b82f6;font-weight:600;margin-top:2px">${esc(invoice.clientCompany)}</div>` : ""}
            <div style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.6">
              ${invoice.clientPhone ? `<div>📞 ${esc(invoice.clientPhone)}</div>` : ""}
              ${invoice.clientEmail ? `<div>✉️ ${esc(invoice.clientEmail)}</div>` : ""}
              ${invoice.clientAddress ? `<div>📍 ${esc(invoice.clientAddress)}</div>` : ""}
            </div>
          </div>

          <!-- Document Timeline Card -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">
              ${bi("تواريخ المعاملة", "Détails & Dates")}
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px dashed #e2e8f0">
              <span style="color:#64748b">${bi("تاريخ الإصدار", "Date d'émission")}</span>
              <span style="font-weight:700;color:#0f172a">${esc(invoice.issueDate)}</span>
            </div>
            ${invoice.dueDate ? `
              <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px dashed #e2e8f0">
                <span style="color:#64748b">${bi("تاريخ الاستحقاق", "Date d'échéance")}</span>
                <span style="font-weight:700;color:#2563eb">${esc(invoice.dueDate)}</span>
              </div>
            ` : ""}
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px">
              <span style="color:#64748b">${bi("العملة المعتمدة", "Devise")}</span>
              <span style="font-weight:700;color:#0f172a">${esc(invoice.currency)}</span>
            </div>
          </div>
        </div>

        <!-- Prestations Table -->
        <div style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:28px;box-shadow:0 1px 3px rgba(0,0,0,0.02)">
          <table style="width:100%;border-collapse:collapse;text-align:start">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
                <th style="padding:13px 18px;text-align:right;font-size:12px;font-weight:700;color:#334155;width:55%">${bi("الخدمة / تفاصيل الإنجاز", "Prestation & Spécifications")}</th>
                <th style="padding:13px 14px;text-align:center;font-size:12px;font-weight:700;color:#334155;width:12%">${bi("الكمية", "Qté")}</th>
                <th style="padding:13px 14px;text-align:center;font-size:12px;font-weight:700;color:#334155;width:18%">${bi("السعر الأحادي", "P.U")}</th>
                <th style="padding:13px 18px;text-align:left;font-size:12px;font-weight:700;color:#334155;width:15%">${bi("الإجمالي", "Montant")}</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.services || []).map((s, idx) => `
                <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#fbfcfe"};border-bottom:1px solid #f1f5f9">
                  <td style="padding:14px 18px;font-size:13px;font-weight:600;color:#0f172a;line-height:1.5">
                    ${esc(s.name)}
                  </td>
                  <td style="padding:14px;text-align:center;font-size:13px;color:#475569;font-weight:500">
                    ${s.qty || 1}
                  </td>
                  <td style="padding:14px;text-align:center;font-size:13px;color:#475569;font-weight:500">
                    ${s.unitPrice != null ? (s.unitPrice).toLocaleString("fr-DZ", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td style="padding:14px 18px;text-align:left;font-size:14px;font-weight:700;color:#0f172a">
                    ${parseFloat(s.price || 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} ${invoice.currency}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Totals & Payment Details Area -->
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:start">
          <!-- Payment Info & Notes -->
          <div>
            ${invoice.notes ? `
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px">
                <div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px">📝 ${bi("ملاحظات وشروط", "Conditions & Modalités")}</div>
                <div style="font-size:12px;color:#1e3a8a;line-height:1.6">${esc(invoice.notes)}</div>
              </div>
            ` : ""}

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
              <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">💳 ${bi("طرق الدفع المتاحة", "Règlement")}</div>
              <div style="font-size:12px;color:#64748b;line-height:1.6">
                <div>• تحويل بنكي أو بريدي (Virement Bancaire / CCP / BaridiMob)</div>
                <div>• الدفع نقداً عند استلام الخدمة (Paiement comptant)</div>
                ${invoice.agencyBank ? `<div style="font-weight:600;color:#0f172a;margin-top:4px">RIB/CCP: ${esc(invoice.agencyBank)}</div>` : ""}
              </div>
            </div>

            <!-- Signature & Stamp Box -->
            <div style="margin-top:20px;border:1px dashed #cbd5e1;border-radius:12px;padding:16px;height:100px;display:flex;flex-direction:column;justify-content:space-between">
              <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">${bi("الختم والتوقيع", "Cachet & Signature")}</div>
              <div style="font-size:11px;color:#cbd5e1;text-align:center">Adpowers Digital Management</div>
            </div>
          </div>

          <!-- Totals -->
          <div>
            ${totalsBlock(invoice, accent)}
          </div>
        </div>

        <!-- Footer Note -->
        <div style="margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b">
          <div style="font-weight:700;color:#0f172a">${bi("شكراً لثقتكم واختياركم لنا", "Merci de votre confiance et de votre collaboration")}</div>
          <div style="margin-top:4px;font-size:11px;color:#94a3b8">${esc(invoice.agencyName)} · ${esc(invoice.agencyWebsite)}</div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE 2: MODERN MINIMAL
// ─────────────────────────────────────────────────────────────
function renderMinimal(invoice) {
  const accent = invoice.primary || "#2563eb";
  return `
    <div style="padding:44px;font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:24px;margin-bottom:32px">
        <div>
          <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em">${esc(invoice.agencyName)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${esc(invoice.agencyTagline)}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">${esc(invoice.agencyPhone)} · ${esc(invoice.agencyEmail)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:900;color:#0f172a">${esc(invoice.docLabel)}</div>
          <div style="font-size:13px;color:#64748b;font-weight:600;margin-top:2px">${esc(invoice.invoiceNumber)}</div>
          <div style="margin-top:8px">${statusBadge(invoice)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">${bi("العميل", "Client")}</div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:4px">${esc(invoice.clientName)}</div>
          ${invoice.clientCompany ? `<div style="font-size:13px;color:#64748b">${esc(invoice.clientCompany)}</div>` : ""}
          ${invoice.clientPhone ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px">${esc(invoice.clientPhone)}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">${bi("التواريخ", "Dates")}</div>
          <div style="font-size:13px;color:#0f172a;font-weight:600;margin-top:4px">${bi("تاريخ الإصدار", "Émission")}: ${esc(invoice.issueDate)}</div>
          ${invoice.dueDate ? `<div style="font-size:13px;color:#2563eb;font-weight:600;margin-top:2px">${bi("الاستحقاق", "Échéance")}: ${esc(invoice.dueDate)}</div>` : ""}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0">
            <th style="padding:10px 0;text-align:right;font-size:12px;font-weight:700;color:#64748b">${bi("الخدمة", "Désignation")}</th>
            <th style="padding:10px 0;text-align:center;font-size:12px;font-weight:700;color:#64748b;width:80px">${bi("الكمية", "Qté")}</th>
            <th style="padding:10px 0;text-align:left;font-size:12px;font-weight:700;color:#64748b;width:150px">${bi("المبلغ", "Montant")} (${invoice.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.services || []).map(s => `
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:14px 0;font-size:14px;font-weight:600;color:#0f172a">${esc(s.name)}</td>
              <td style="padding:14px 0;text-align:center;font-size:13px;color:#64748b">${s.qty || 1}</td>
              <td style="padding:14px 0;text-align:left;font-size:14px;font-weight:700;color:#0f172a">${parseFloat(s.price || 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end">
        ${totalsBlock(invoice, accent)}
      </div>

      <div style="margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
        ${esc(invoice.agencyName)} · ${esc(invoice.agencyWebsite)} · ${esc(invoice.agencyPhone)}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE 3: CORPORATE CLASSIC
// ─────────────────────────────────────────────────────────────
function renderClassic(invoice) {
  const accent = invoice.primary || "#2563eb";
  return renderExecutive(invoice);
}

export const TEMPLATES = [
  { id: "executive", name: "⚡ أدباورز ديجيتال · Adpowers Executive", emoji: "🚀", description: "تصميم وكالة تسويق احترافي فخم مع تفاصيل كاملة" },
  { id: "minimal", name: "📋 بسيط · Minimal Clean", emoji: "✨", description: "تصميم أنيق وعصري بخطوط ناعمة" },
  { id: "classic", name: "📄 كلاسيكي · Corporate", emoji: "🏛️", description: "تصميم رسمي مناسب للشركات والتعاملات الإدارية" },
];

export function renderInvoiceContent(rawInvoice, templateId = "executive", agency) {
  const invoice = rawInvoice.docLabel ? rawInvoice : normalizeInvoice(rawInvoice, agency);
  switch (templateId) {
    case "minimal":
      return renderMinimal(invoice);
    case "classic":
      return renderClassic(invoice);
    case "executive":
    default:
      return renderExecutive(invoice);
  }
}
