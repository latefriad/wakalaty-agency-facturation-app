const prisma = require("../../config/database");

function computeMetrics(entry) {
  const actualSpend = Number(entry.actualSpend || 0);
  const revenueGenerated = Number(entry.revenueGenerated || 0);
  const amountBilled = Number(entry.amountBilled || 0);
  const clientAdBudget = Number(entry.clientAdBudget || 0);
  const orders = Number(entry.orders || 0);

  const roas = actualSpend > 0 ? Number((revenueGenerated / actualSpend).toFixed(2)) : 0;
  const cpa = orders > 0 ? Number((actualSpend / orders).toFixed(2)) : 0;
  const agencyMargin = Number((amountBilled - actualSpend).toFixed(2));
  const budgetUsedPercent =
    clientAdBudget > 0 ? Number(((actualSpend / clientAdBudget) * 100).toFixed(1)) : 0;

  return {
    ...entry,
    actualSpend,
    revenueGenerated,
    amountBilled,
    clientAdBudget,
    orders,
    roas,
    cpa,
    agencyMargin,
    budgetUsedPercent,
  };
}

async function list(agencyId, req) {
  const { month, startMonth, endMonth, clientId, platform, search } = req.query;

  const where = {
    agencyId,
    ...(clientId ? { clientId } : {}),
    ...(platform ? { platform } : {}),
    ...(month ? { month } : {}),
    ...(startMonth || endMonth
      ? {
          month: {
            ...(startMonth ? { gte: startMonth } : {}),
            ...(endMonth ? { lte: endMonth } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { campaignName: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rawEntries = await prisma.adSpendEntry.findMany({
    where,
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });

  // Client lookup
  const clientIds = [...new Set(rawEntries.map((e) => e.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, agencyId },
    select: { id: true, name: true, company: true, phone: true },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const data = rawEntries.map((e) => {
    const computed = computeMetrics(e);
    return {
      ...computed,
      client: clientMap.get(e.clientId) || { id: e.clientId, name: "Client inconnu" },
    };
  });

  // Filter by client search if client name matches
  const finalData = search
    ? data.filter(
        (item) =>
          item.campaignName?.toLowerCase().includes(search.toLowerCase()) ||
          item.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
          item.client?.company?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  // Aggregate summary
  const totalSpend = finalData.reduce((s, i) => s + i.actualSpend, 0);
  const totalBilled = finalData.reduce((s, i) => s + i.amountBilled, 0);
  const totalMargin = finalData.reduce((s, i) => s + i.agencyMargin, 0);
  const totalOrders = finalData.reduce((s, i) => s + i.orders, 0);
  const totalRevenue = finalData.reduce((s, i) => s + i.revenueGenerated, 0);
  const avgROAS = totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0;
  const avgCPA = totalOrders > 0 ? Number((totalSpend / totalOrders).toFixed(2)) : 0;

  return {
    data: finalData,
    summary: {
      totalSpend: Number(totalSpend.toFixed(2)),
      totalBilled: Number(totalBilled.toFixed(2)),
      totalMargin: Number(totalMargin.toFixed(2)),
      totalOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgROAS,
      avgCPA,
    },
  };
}

async function summary(agencyId, req) {
  const { startMonth, endMonth, clientId, platform } = req.query;

  const where = {
    agencyId,
    ...(clientId ? { clientId } : {}),
    ...(platform ? { platform } : {}),
    ...(startMonth || endMonth
      ? {
          month: {
            ...(startMonth ? { gte: startMonth } : {}),
            ...(endMonth ? { lte: endMonth } : {}),
          },
        }
      : {}),
  };

  const entries = await prisma.adSpendEntry.findMany({
    where,
    orderBy: { month: "asc" },
  });

  const clientIds = [...new Set(entries.map((e) => e.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, agencyId },
    select: { id: true, name: true, company: true },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Month series aggregation
  const monthMap = new Map();
  for (const e of entries) {
    const m = e.month;
    if (!monthMap.has(m)) {
      monthMap.set(m, {
        month: m,
        spend: 0,
        revenue: 0,
        billed: 0,
        margin: 0,
        orders: 0,
      });
    }
    const curr = monthMap.get(m);
    curr.spend += Number(e.actualSpend || 0);
    curr.revenue += Number(e.revenueGenerated || 0);
    curr.billed += Number(e.amountBilled || 0);
    curr.orders += Number(e.orders || 0);
    curr.margin += Number((e.amountBilled || 0) - (e.actualSpend || 0));
  }

  const monthSeries = Array.from(monthMap.values()).map((row) => ({
    ...row,
    roas: row.spend > 0 ? Number((row.revenue / row.spend).toFixed(2)) : 0,
    cpa: row.orders > 0 ? Number((row.spend / row.orders).toFixed(2)) : 0,
    spend: Number(row.spend.toFixed(2)),
    revenue: Number(row.revenue.toFixed(2)),
    billed: Number(row.billed.toFixed(2)),
    margin: Number(row.margin.toFixed(2)),
  }));

  // Client summary aggregation
  const perClientMap = new Map();
  for (const e of entries) {
    const cId = e.clientId;
    if (!perClientMap.has(cId)) {
      const client = clientMap.get(cId);
      perClientMap.set(cId, {
        clientId: cId,
        clientName: client?.name || "Client inconnu",
        company: client?.company || null,
        spend: 0,
        revenue: 0,
        billed: 0,
        margin: 0,
        orders: 0,
      });
    }
    const curr = perClientMap.get(cId);
    curr.spend += Number(e.actualSpend || 0);
    curr.revenue += Number(e.revenueGenerated || 0);
    curr.billed += Number(e.amountBilled || 0);
    curr.orders += Number(e.orders || 0);
    curr.margin += Number((e.amountBilled || 0) - (e.actualSpend || 0));
  }

  const clientSeries = Array.from(perClientMap.values()).map((row) => ({
    ...row,
    roas: row.spend > 0 ? Number((row.revenue / row.spend).toFixed(2)) : 0,
    cpa: row.orders > 0 ? Number((row.spend / row.orders).toFixed(2)) : 0,
    spend: Number(row.spend.toFixed(2)),
    revenue: Number(row.revenue.toFixed(2)),
    billed: Number(row.billed.toFixed(2)),
    margin: Number(row.margin.toFixed(2)),
  }));

  return {
    monthSeries,
    clientSeries,
  };
}

async function create(agencyId, data, createdById) {
  const {
    clientId,
    month,
    platform,
    campaignName,
    clientAdBudget,
    actualSpend,
    amountBilled,
    orders,
    revenueGenerated,
    notes,
  } = data;

  const entry = await prisma.adSpendEntry.upsert({
    where: {
      agencyId_clientId_month_platform_campaignName: {
        agencyId,
        clientId,
        month,
        platform: platform || "META",
        campaignName: (campaignName || "").trim(),
      },
    },
    update: {
      clientAdBudget: Number(clientAdBudget || 0),
      actualSpend: Number(actualSpend || 0),
      amountBilled: Number(amountBilled || 0),
      orders: Number(orders || 0),
      revenueGenerated: Number(revenueGenerated || 0),
      notes: notes || null,
    },
    create: {
      agencyId,
      clientId,
      month,
      platform: platform || "META",
      campaignName: (campaignName || "").trim(),
      clientAdBudget: Number(clientAdBudget || 0),
      actualSpend: Number(actualSpend || 0),
      amountBilled: Number(amountBilled || 0),
      orders: Number(orders || 0),
      revenueGenerated: Number(revenueGenerated || 0),
      notes: notes || null,
      createdById: createdById || null,
    },
  });

  return computeMetrics(entry);
}

async function update(agencyId, id, data) {
  const existing = await prisma.adSpendEntry.findFirst({ where: { id, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Entrée Ad Spend introuvable"), { status: 404 });
  }

  const payload = { ...data };
  if ("campaignName" in payload) {
    payload.campaignName = (payload.campaignName || "").trim();
  }
  if ("clientAdBudget" in payload) {
    payload.clientAdBudget = Number(payload.clientAdBudget || 0);
  }
  if ("actualSpend" in payload) {
    payload.actualSpend = Number(payload.actualSpend || 0);
  }
  if ("amountBilled" in payload) {
    payload.amountBilled = Number(payload.amountBilled || 0);
  }
  if ("orders" in payload) {
    payload.orders = Number(payload.orders || 0);
  }
  if ("revenueGenerated" in payload) {
    payload.revenueGenerated = Number(payload.revenueGenerated || 0);
  }

  const updated = await prisma.adSpendEntry.update({
    where: { id },
    data: payload,
  });

  return computeMetrics(updated);
}

async function remove(agencyId, id) {
  const existing = await prisma.adSpendEntry.findFirst({ where: { id, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Entrée Ad Spend introuvable"), { status: 404 });
  }

  await prisma.adSpendEntry.delete({ where: { id } });
  return { id };
}

async function exportExcel(agencyId, req, res) {
  const ExcelJS = require("exceljs");
  const listResult = await list(agencyId, req);
  const summaryResult = await summary(agencyId, req);

  const wb = new ExcelJS.Workbook();
  const money = (v) => Math.round((v ?? 0) * 100) / 100;

  // Sheet 1: Détail Campagnes
  const sheet1 = wb.addWorksheet("Campagnes Ad Spend");
  sheet1.columns = [
    { header: "Mois", key: "month", width: 12 },
    { header: "Client", key: "client", width: 26 },
    { header: "Plateforme", key: "platform", width: 14 },
    { header: "Campagne", key: "campaign", width: 26 },
    { header: "Budget Client (DZD)", key: "budget", width: 18 },
    { header: "Dépense Réelle (DZD)", key: "spend", width: 18 },
    { header: "Montant Facturé (DZD)", key: "billed", width: 18 },
    { header: "Commandes", key: "orders", width: 12 },
    { header: "Revenu Généré (DZD)", key: "revenue", width: 18 },
    { header: "ROAS", key: "roas", width: 10 },
    { header: "CPA (DZD)", key: "cpa", width: 12 },
    { header: "Marge Agence (DZD)", key: "margin", width: 18 },
    { header: "% Budget Consommé", key: "budgetUsed", width: 18 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  listResult.data.forEach((row) => {
    sheet1.addRow({
      month: row.month,
      client: row.client?.name || "",
      platform: row.platform,
      campaign: row.campaignName || "—",
      budget: money(row.clientAdBudget),
      spend: money(row.actualSpend),
      billed: money(row.amountBilled),
      orders: row.orders,
      revenue: money(row.revenueGenerated),
      roas: row.roas,
      cpa: money(row.cpa),
      margin: money(row.agencyMargin),
      budgetUsed: `${row.budgetUsedPercent}%`,
      notes: row.notes || "",
    });
  });

  // Sheet 2: Synthèse par Mois
  const sheet2 = wb.addWorksheet("Synthèse Mensuelle");
  sheet2.columns = [
    { header: "Mois", key: "month", width: 14 },
    { header: "Dépense Réelle (DZD)", key: "spend", width: 20 },
    { header: "Revenu Généré (DZD)", key: "revenue", width: 20 },
    { header: "Montant Facturé (DZD)", key: "billed", width: 20 },
    { header: "Marge Nette (DZD)", key: "margin", width: 20 },
    { header: "Commandes", key: "orders", width: 12 },
    { header: "ROAS Global", key: "roas", width: 12 },
    { header: "CPA Moyen (DZD)", key: "cpa", width: 14 },
  ];

  summaryResult.monthSeries.forEach((row) => {
    sheet2.addRow({
      month: row.month,
      spend: money(row.spend),
      revenue: money(row.revenue),
      billed: money(row.billed),
      margin: money(row.margin),
      orders: row.orders,
      roas: row.roas,
      cpa: money(row.cpa),
    });
  });

  // Format header row bold
  [sheet1, sheet2].forEach((ws) => {
    if (ws.getRow(1).values.length) ws.getRow(1).font = { bold: true };
  });

  const filename = `wakalati-adspend-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

module.exports = {
  list,
  summary,
  create,
  update,
  remove,
  exportExcel,
};
