const dashboardService = require("./dashboard.service");
const { success } = require("../../utils/response");

// Période demandée par le front (?from=YYYY-MM-DD&to=YYYY-MM-DD).
// Défaut : 12 mois glissants. `to` est inclusif (fin de journée).
function parsePeriod(query) {
  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  let to = now;

  if (query.from) {
    from = new Date(query.from);
    if (Number.isNaN(from.getTime())) throw Object.assign(new Error("Date 'from' invalide"), { status: 400 });
  }
  if (query.to) {
    to = new Date(query.to);
    if (Number.isNaN(to.getTime())) throw Object.assign(new Error("Date 'to' invalide"), { status: 400 });
    to.setHours(23, 59, 59, 999);
  }
  if (to < from) throw Object.assign(new Error("Période invalide (to < from)"), { status: 400 });
  return { from, to };
}

exports.getDashboard = async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    success(res, await dashboardService.getDashboard(req.agencyId, period));
  } catch (err) {
    next(err);
  }
};

// Rapport Excel : les mêmes chiffres que le dashboard (mêmes définitions,
// mêmes requêtes), jamais un recalcul parallèle.
exports.exportXlsx = async (req, res, next) => {
  try {
    const ExcelJS = require("exceljs");
    const period = parsePeriod(req.query);
    const dash = await dashboardService.getDashboard(req.agencyId, period);

    const wb = new ExcelJS.Workbook();
    const money = (v) => Math.round((v ?? 0) * 100) / 100;

    const resume = wb.addWorksheet("Résumé");
    resume.columns = [{ width: 42 }, { width: 22 }];
    resume.addRows([
      ["Période", `${period.from.toISOString().slice(0, 10)} → ${period.to.toISOString().slice(0, 10)}`],
      ["Devise", dash.currency],
      [],
      ["Trésorerie actuelle (solde initial + encaissé − dépensé)", money(dash.treasury.balance)],
      ["Encaissé (période) — paiements reçus, partiels inclus", money(dash.cash.received)],
      ["Dépenses (période)", money(dash.expenses.total)],
      ["Bénéfice net (encaissé − dépenses)", money(dash.profit.net)],
      ["Marge nette", dash.profit.margin != null ? `${(dash.profit.margin * 100).toFixed(1)}%` : "—"],
      ["Facturé (période) — hors brouillons/annulées", money(dash.billed.total)],
      ["Encours clients (photo)", money(dash.outstanding.total)],
      ["  dont en retard", money(dash.outstanding.overdue)],
      ["DSO (jours, pondéré par montants)", dash.dso.days ?? "—"],
      [],
      ["Ancienneté des créances", ""],
      ["  À échoir", money(dash.aging.notDue)],
      ["  1-30 jours de retard", money(dash.aging.days1to30)],
      ["  31-60 jours", money(dash.aging.days31to60)],
      ["  60+ jours", money(dash.aging.days60plus)],
    ]);
    resume.getColumn(2).alignment = { horizontal: "right" };

    const cashSheet = wb.addWorksheet("Encaissements");
    cashSheet.columns = [
      { header: "Mois", key: "month", width: 12 },
      { header: `Encaissé (${dash.currency})`, key: "received", width: 20 },
    ];
    dash.cashSeries.forEach((r) => cashSheet.addRow({ month: r.month, received: money(r.received) }));

    const expSheet = wb.addWorksheet("Dépenses");
    expSheet.columns = [
      { header: "Catégorie", key: "category", width: 20 },
      { header: `Montant (${dash.currency})`, key: "total", width: 20 },
    ];
    dash.expenses.byCategory.forEach((r) => expSheet.addRow({ category: r.category, total: money(r.total) }));

    const clientsSheet = wb.addWorksheet("Clients");
    clientsSheet.columns = [
      { header: "Client", key: "name", width: 30 },
      { header: "Encaissé (période)", key: "received", width: 20 },
      { header: "Encours", key: "outstanding", width: 16 },
      { header: "Coûts directs", key: "directCosts", width: 16 },
      { header: "Profit (encaissé − coûts directs)", key: "profit", width: 28 },
    ];
    dash.clientProfit.forEach((r) =>
      clientsSheet.addRow({
        name: r.name,
        received: money(r.received),
        outstanding: money(r.outstanding),
        directCosts: money(r.directCosts),
        profit: money(r.profit),
      })
    );

    const overdueSheet = wb.addWorksheet("Relances");
    overdueSheet.columns = [
      { header: "Facture", key: "number", width: 18 },
      { header: "Client", key: "clientName", width: 30 },
      { header: "Échéance", key: "dueDate", width: 14 },
      { header: "Jours de retard", key: "daysLate", width: 16 },
      { header: `Reste dû (${dash.currency})`, key: "remaining", width: 18 },
    ];
    dash.worstOverdue.forEach((r) =>
      overdueSheet.addRow({
        number: r.number,
        clientName: r.clientName,
        dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "",
        daysLate: r.daysLate,
        remaining: money(r.remaining),
      })
    );

    [resume, cashSheet, expSheet, clientsSheet, overdueSheet].forEach((ws) => {
      if (ws.getRow(1).values.length) ws.getRow(1).font = { bold: true };
    });

    const filename = `wakalati-finance-${period.from.toISOString().slice(0, 10)}_${period.to.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};
