// Libellés bilingues arabe / français : chaque intitulé du document est rendu
// en arabe (principal, RTL) avec sa traduction française en dessous, en plus
// petit et grisé. Les agences algériennes émettent souvent des factures
// bilingues ; le PDF doit donc parler les deux langues sans sélecteur.
const STATUS = {
  EN_ATTENTE: { ar: "في الانتظار", fr: "En attente", color: "#f59e0b" },
  SENT:       { ar: "مُرسَلة", fr: "Envoyée", color: "#0ea5e9" },
  VUE:        { ar: "تمت المعاينة", fr: "Vue", color: "#6366f1" },
  DRAFT:      { ar: "مسودة", fr: "Brouillon", color: "#94a3b8" },
  PAYEE:      { ar: "مدفوعة", fr: "Payée", color: "#10b981" },
  ANNULEE:    { ar: "ملغاة", fr: "Annulée", color: "#ef4444" },
  EN_RETARD:  { ar: "متأخرة", fr: "En retard", color: "#dc2626" },
  // Tolère les anciennes valeurs minuscules éventuellement stockées.
  en_attente: { ar: "في الانتظار", fr: "En attente", color: "#f59e0b" },
  payée:      { ar: "مدفوعة", fr: "Payée", color: "#10b981" },
  annulée:    { ar: "ملغاة", fr: "Annulée", color: "#ef4444" },
};

// Symbole de devise : DZD s'affiche « دج » (usage local), les autres gardent
// leur symbole international.
const CURRENCY_SYMBOL = { DZD: "دج", EUR: "€", USD: "$" };
function currencySymbol(code) {
  if (!code || code === "DZD") return "دج";
  return CURRENCY_SYMBOL[code] || code;
}

// Adapte la facture renvoyée par l'API (number, client.name, items…) au
// modèle attendu par les templates : sans cette étape, le PDF affichait
// des "undefined" partout. Transporte aussi le logo, la charte couleur et
// les coordonnées légales de l'agence (NIF/RC), indispensables sur une
// facture algérienne.
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
  const primary = agency?.primaryColor || "#3b82f6";
  const secondary = agency?.secondaryColor || "#1e293b";
  return {
    invoiceNumber: raw.number || raw.invoiceNumber || "",
    docLabel: raw.docType === "DEVIS" ? "عرض سعر" : "فاتورة",
    docLabelFr: raw.docType === "DEVIS" ? "Devis" : "Facture",
    clientName: raw.client?.name || raw.clientName || "",
    agencyName: agency?.name || raw.agencyName || "",
    agencyLogo: agency?.logo || null,
    agencyAddress: agency?.address || "",
    agencyPhone: agency?.phone || "",
    agencyEmail: agency?.email || "",
    agencyTaxId: agency?.taxId || "",
    primary,
    secondary,
    status: raw.displayStatus || raw.status,
    dueDate: raw.dueDate ? new Date(raw.dueDate).toLocaleDateString("fr-DZ") : null,
    issueDate: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString("fr-DZ") : null,
    services,
    subtotal,
    tax: raw.tax || 0,
    taxAmount,
    discount: raw.discount || 0,
    deposit: raw.depositAmount || 0,
    penalty: raw.penaltyAmount || 0,
    total: raw.total ?? subtotal + taxAmount,
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

// Intitulé bilingue : arabe en principal, français dessous en plus petit.
function bi(ar, fr, { color = "#94a3b8", size = 11 } = {}) {
  return `${esc(ar)}<span style="font-size:${size}px;color:${color};font-weight:400"> · ${esc(fr)}</span>`;
}

// En-tête d'agence commun : logo (image uploadée) ou pastille colorée, nom,
// coordonnées et identifiant fiscal.
function agencyBlock(invoice, { onDark = false } = {}) {
  const sub = onDark ? "rgba(255,255,255,0.65)" : "#64748b";
  const logo = invoice.agencyLogo
    ? `<img src="${esc(invoice.agencyLogo)}" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0" crossorigin="anonymous"/>`
    : `<div style="width:52px;height:52px;border-radius:10px;background:${invoice.primary}22;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🏢</div>`;
  const lines = [
    invoice.agencyAddress && `<div style="font-size:12px;color:${sub}">${esc(invoice.agencyAddress)}</div>`,
    (invoice.agencyPhone || invoice.agencyEmail) &&
      `<div style="font-size:12px;color:${sub}">${esc([invoice.agencyPhone, invoice.agencyEmail].filter(Boolean).join(" · "))}</div>`,
    invoice.agencyTaxId && `<div style="font-size:11px;color:${sub}">NIF/RC · ${esc(invoice.agencyTaxId)}</div>`,
  ].filter(Boolean).join("");
  return `
    <div style="display:flex;align-items:center;gap:12px">
      ${logo}
      <div>
        <div style="font-size:20px;font-weight:800;color:${onDark ? "#fff" : invoice.primary}">${esc(invoice.agencyName) || "وكالة التسويق"}</div>
        <div style="font-size:12px;color:${sub};margin-top:2px">Agence Marketing · الجزائر</div>
        ${lines}
      </div>
    </div>`;
}

function totalsBlock(invoice, accent) {
  const c = invoice.currency;
  const row = (labelAr, labelFr, value, opts = {}) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px${opts.strong ? ";font-weight:700" : ""}">
      <span style="color:${opts.strong ? accent : "#64748b"}">${bi(labelAr, labelFr, { color: opts.strong ? accent : "#94a3b8" })}</span>
      <span style="color:${opts.strong ? accent : "inherit"}">${value.toFixed(2)} ${c}</span>
    </div>`;
  return `
    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;max-width:340px;margin-inline-start:auto">
      ${row("المجموع الجزئي", "Sous-total", invoice.subtotal || 0)}
      ${invoice.discount ? row("الخصم", "Remise", -invoice.discount) : ""}
      ${row(`الضريبة (${invoice.tax}%)`, "TVA", invoice.taxAmount || 0)}
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:18px;color:${accent};border-top:2px solid #e2e8f0;padding-top:10px;margin-top:6px">
        <span>${bi("المجموع الكلي", "Total TTC", { color: accent })}</span>
        <span>${(invoice.total || 0).toFixed(2)} ${c}</span>
      </div>
      ${invoice.deposit ? row("عربون مطلوب", "Acompte à verser", invoice.deposit, { strong: false }) : ""}
      ${invoice.penalty ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#dc2626">
        <span>${bi("غرامة تأخير", "Pénalité de retard", { color: "#dc2626" })}</span>
        <span>+${invoice.penalty.toFixed(2)} ${c}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;color:#dc2626;border-top:1px dashed #fca5a5;padding-top:8px;margin-top:4px">
        <span>${bi("المبلغ الإجمالي المستحق", "Total à régler", { color: "#dc2626" })}</span>
        <span>${((invoice.total || 0) + invoice.penalty).toFixed(2)} ${c}</span>
      </div>` : ""}
    </div>`;
}

export const TEMPLATES = [
  { id: "classic", name: "كلاسيكي · Classique", emoji: "📄", description: "تصميم تقليدي مع رأس ملوّن" },
  { id: "modern", name: "حديث · Moderne", emoji: "✨", description: "تصميم عصري بألوان داكنة" },
  { id: "minimal", name: "بسيط · Minimal", emoji: "📋", description: "تصميم نظيف بخطوط رفيعة" },
];

function statusBadge(invoice, tint = 0x22) {
  const st = STATUS[invoice.status] || STATUS.EN_ATTENTE;
  const alpha = tint === 0x33 ? "33" : "22";
  return `<span style="background:${st.color}${alpha};color:${st.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">${bi(st.ar, st.fr, { color: st.color, size: 10 })}</span>`;
}

function renderClassic(invoice) {
  const accent = invoice.primary;
  return `
    <div style="padding:40px">
      <div style="display:flex;justify-content:space-between;margin-bottom:36px">
        ${agencyBlock(invoice)}
        <div style="text-align:left">
          <div style="font-size:20px;font-weight:700">${esc(invoice.docLabel)}<span style="font-size:13px;color:#94a3b8;font-weight:400"> · ${esc(invoice.docLabelFr)}</span></div>
          <div style="font-size:14px;color:${accent};font-weight:600;margin-top:4px">${esc(invoice.invoiceNumber)}</div>
          <div style="margin-top:8px">${statusBadge(invoice)}</div>
        </div>
      </div>
      <div style="border-top:2px solid #e2e8f0;margin-bottom:28px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
        <div>
          <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:8px">${bi("صادرة إلى", "Destinataire")}</div>
          <div style="font-weight:600;font-size:15px">${esc(invoice.clientName)}</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:13px;color:#64748b;margin-bottom:6px"><span style="font-weight:600">${bi("تاريخ الإصدار", "Date")}: </span>${esc(invoice.issueDate) || ""}</div>
          ${invoice.dueDate ? `<div style="font-size:13px;color:#64748b"><span style="font-weight:600">${bi("تاريخ الاستحقاق", "Échéance")}: </span>${esc(invoice.dueDate)}</div>` : ""}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:right;font-size:13px;color:#64748b;border-bottom:2px solid #e2e8f0">${bi("الخدمة", "Désignation")}</th>
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#64748b;border-bottom:2px solid #e2e8f0;width:150px">${bi("المبلغ", "Montant")} (${invoice.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.services || []).map(s => `
            <tr>
              <td style="padding:12px 14px;font-size:14px;border-bottom:1px solid #f1f5f9">${esc(s.name)}</td>
              <td style="padding:12px 14px;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:left">${parseFloat(s.price || 0).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${totalsBlock(invoice, accent)}
      ${invoice.notes ? `<div style="margin-top:28px;padding:16px;background:#fefce8;border-radius:10px;font-size:13px;color:#92400e"><strong>${bi("ملاحظات", "Notes")}: </strong>${esc(invoice.notes)}</div>` : ""}
      <div style="margin-top:40px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:20px">${bi("شكراً لثقتكم", "Merci de votre confiance")} — ${esc(invoice.agencyName) || "وكالة التسويق"}</div>
    </div>
  `;
}

function renderModern(invoice) {
  const accent = invoice.primary;
  return `
    <div style="padding:0">
      <div style="background:linear-gradient(135deg,${invoice.secondary},${invoice.primary});padding:32px 40px;color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${agencyBlock(invoice, { onDark: true })}
          <div style="text-align:left">
            <div style="font-size:14px;color:rgba(255,255,255,0.7);font-weight:500">${esc(invoice.docLabel)} · ${esc(invoice.docLabelFr)}</div>
            <div style="font-size:20px;font-weight:700;letter-spacing:1px;margin-top:2px">${esc(invoice.invoiceNumber)}</div>
            <div style="margin-top:8px">${statusBadge(invoice, 0x33)}</div>
          </div>
        </div>
      </div>
      <div style="padding:32px 40px">
        <div style="display:flex;justify-content:space-between;margin-bottom:32px;background:#f8fafc;border-radius:12px;padding:16px 20px">
          <div>
            <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:4px">${bi("العميل", "Client")}</div>
            <div style="font-weight:700;font-size:16px">${esc(invoice.clientName)}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:12px;color:#64748b;margin-bottom:4px"><span style="color:#94a3b8">${bi("تاريخ الإصدار", "Date")}:</span> ${esc(invoice.issueDate) || ""}</div>
            ${invoice.dueDate ? `<div style="font-size:12px;color:#64748b"><span style="color:#94a3b8">${bi("تاريخ الاستحقاق", "Échéance")}:</span> ${esc(invoice.dueDate)}</div>` : ""}
          </div>
        </div>
        <table style="width:100%;border-collapse:separate;border-spacing:0 6px;margin-bottom:24px">
          <thead>
            <tr>
              <th style="padding:8px 16px;text-align:right;font-size:12px;color:#94a3b8;font-weight:600">${bi("الخدمة", "Désignation")}</th>
              <th style="padding:8px 16px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;width:150px">${bi("المبلغ", "Montant")}</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.services || []).map(s => `
              <tr style="background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                <td style="padding:12px 16px;font-size:14px;font-weight:500">${esc(s.name)}</td>
                <td style="padding:12px 16px;font-size:14px;text-align:left;font-weight:600">${parseFloat(s.price || 0).toFixed(2)} ${invoice.currency}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${totalsBlock(invoice, accent)}
        ${invoice.notes ? `<div style="margin-top:24px;padding:16px;background:#fefce8;border-radius:10px;font-size:13px;color:#92400e"><strong>${bi("ملاحظات", "Notes")}: </strong>${esc(invoice.notes)}</div>` : ""}
        <div style="margin-top:48px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:20px">
          ${bi("شكراً لثقتكم", "Merci de votre confiance")} — ${esc(invoice.agencyName) || "وكالة التسويق"}
        </div>
      </div>
    </div>
  `;
}

function renderMinimal(invoice) {
  const accent = invoice.primary;
  return `
    <div style="padding:48px 40px;font-family:'Segoe UI',Tahoma,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        ${agencyBlock(invoice)}
        <div style="text-align:left">
          <div style="font-size:26px;font-weight:200;color:#0f172a">${esc(invoice.docLabel)}</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px">${esc(invoice.docLabelFr)} · ${esc(invoice.invoiceNumber)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:32px">
        <div>
          <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:6px">${bi("صادرة إلى", "Destinataire")}</div>
          <div style="font-size:15px;font-weight:600;color:#0f172a">${esc(invoice.clientName)}</div>
        </div>
        <div style="text-align:left;font-size:12px;color:#94a3b8">
          <div>${esc(invoice.issueDate) || ""}</div>
          ${invoice.dueDate ? `<div style="margin-top:4px">${bi("الاستحقاق", "Échéance")}: ${esc(invoice.dueDate)}</div>` : ""}
        </div>
      </div>
      ${(invoice.services || []).map(s => `
        <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #f1f5f9">
          <span style="font-size:14px;color:#334155">${esc(s.name)}</span>
          <span style="font-size:14px;color:#334155;font-weight:500">${parseFloat(s.price || 0).toFixed(2)} ${invoice.currency}</span>
        </div>
      `).join("")}
      <div style="margin-top:24px">${totalsBlock(invoice, accent)}</div>
      <div style="margin-top:20px">${statusBadge(invoice)}</div>
      ${invoice.notes ? `<div style="margin-top:24px;padding:14px;background:#f8fafc;border-radius:6px;font-size:13px;color:#64748b;border-inline-start:3px solid #e2e8f0"><strong>${bi("ملاحظات", "Notes")}: </strong>${esc(invoice.notes)}</div>` : ""}
      <div style="margin-top:48px;text-align:center;color:#cbd5e1;font-size:11px;padding-top:20px;border-top:1px solid #f1f5f9">${bi("شكراً لثقتكم", "Merci de votre confiance")} — ${esc(invoice.agencyName) || "وكالة التسويق"}</div>
    </div>
  `;
}

export function renderInvoiceContent(rawInvoice, templateId, agency) {
  const invoice = rawInvoice.docLabel ? rawInvoice : normalizeInvoice(rawInvoice, agency);
  switch (templateId) {
    case "modern":
      return renderModern(invoice);
    case "minimal":
      return renderMinimal(invoice);
    default:
      return renderClassic(invoice);
  }
}
