// Gabarits d'e-mails facture. Le lien public permet au client de consulter
// et télécharger sa facture sans compte.
function fmt(n, currency) {
  return `${(n || 0).toFixed(2)} ${currency || "DZD"}`;
}

function baseLayout(inner) {
  return `
  <div style="font-family:Segoe UI,Tahoma,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
    <div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px">${inner}</div>
    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px">
      E-mail automatique — merci de ne pas répondre directement.
    </p>
  </div>`;
}

function invoiceEmail({ invoice, agency, publicUrl }) {
  const docLabel = invoice.docType === "DEVIS" ? "Devis" : "Facture";
  const subject = `${docLabel} ${invoice.number} — ${agency.name}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px">${agency.name}</h2>
    <p style="margin:0 0 16px;color:#64748b">${docLabel} <strong>${invoice.number}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b">Montant HT</td><td style="text-align:right">${fmt(invoice.subtotal, agency.currency)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">TVA</td><td style="text-align:right">${fmt(invoice.taxAmount, agency.currency)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid #e2e8f0">Total TTC</td><td style="text-align:right;font-weight:700;border-top:1px solid #e2e8f0">${fmt(invoice.total, agency.currency)}</td></tr>
    </table>
    ${invoice.dueDate ? `<p style="font-size:13px;color:#64748b">Échéance : ${new Date(invoice.dueDate).toLocaleDateString("fr-FR")}</p>` : ""}
    <p style="text-align:center;margin:24px 0 8px">
      <a href="${publicUrl}" style="background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">
        Consulter la ${docLabel.toLowerCase()}
      </a>
    </p>
  `);
  return { subject, html };
}

// variant "post" = relance après échéance (ferme, rouge) ;
// variant "pre"  = rappel de courtoisie avant échéance (aimable, orange).
function reminderEmail({ invoice, agency, publicUrl, variant = "post" }) {
  const dueMs = new Date(invoice.dueDate).getTime();
  const amount = fmt(invoice.balance ?? invoice.total, agency.currency);
  const link = (color, label) => `
    <p style="text-align:center;margin:24px 0 8px">
      <a href="${publicUrl}" style="background:${color};color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">${label}</a>
    </p>
    <p style="font-size:12px;color:#94a3b8">Si le règlement a déjà été effectué, merci d'ignorer ce message.</p>`;

  if (variant === "pre") {
    const days = Math.max(0, Math.ceil((dueMs - Date.now()) / 86400000));
    const subject = `Rappel — Facture ${invoice.number} à régler sous ${days} jour(s) (${agency.name})`;
    const html = baseLayout(`
      <h2 style="margin:0 0 4px">${agency.name}</h2>
      <p style="margin:0 0 16px;color:#0369a1">
        🔔 Petit rappel : la facture <strong>${invoice.number}</strong> arrive à échéance dans ${days} jour(s).
      </p>
      <p style="font-size:15px">Montant à régler : <strong>${amount}</strong></p>
      ${link("#0ea5e9", "Voir la facture")}
    `);
    return { subject, html };
  }

  const days = Math.floor((Date.now() - dueMs) / 86400000);
  const subject = `Rappel — Facture ${invoice.number} en attente de paiement (${agency.name})`;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px">${agency.name}</h2>
    <p style="margin:0 0 16px;color:#b45309">
      ⏰ La facture <strong>${invoice.number}</strong> est échue depuis ${days} jour(s).
    </p>
    <p style="font-size:15px">Montant restant dû : <strong>${amount}</strong></p>
    ${link("#dc2626", "Voir la facture")}
  `);
  return { subject, html };
}

module.exports = { invoiceEmail, reminderEmail };
