const prisma = require("../../config/database");

function getMonthDateBounds(monthStr) {
  let year, month;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const normalizedMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  return { from, to, monthStr: normalizedMonthStr };
}

async function getClientMonthlyReport(agencyId, clientId, monthQuery) {
  const { from, to, monthStr } = getMonthDateBounds(monthQuery);

  // 1. Client Info
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      address: true,
      currency: true,
    },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // 2. Agency Info (for branding)
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      logo: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      primaryColor: true,
      secondaryColor: true,
      nif: true,
      nis: true,
      rc: true,
      rib: true,
      bankName: true,
    },
  });

  // 3. Invoices in the month
  const invoices = await prisma.invoice.findMany({
    where: {
      agencyId,
      clientId,
      docType: "FACTURE",
      status: { notIn: ["DRAFT", "ANNULEE"] },
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      total: true,
      currency: true,
      exchangeRate: true,
      status: true,
      createdAt: true,
      dueDate: true,
    },
  });

  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum + Number(inv.total || 0) * Number(inv.exchangeRate || 1),
    0
  );

  // 4. Payments received in the month
  const payments = await prisma.payment.findMany({
    where: {
      agencyId,
      status: "APPROVED",
      createdAt: { gte: from, lte: to },
      invoice: {
        clientId,
        docType: "FACTURE",
        status: { not: "ANNULEE" },
      },
    },
    include: {
      invoice: {
        select: {
          number: true,
          exchangeRate: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0) * Number(p.invoice?.exchangeRate || 1),
    0
  );

  // 5. Total outstanding (all unpaid non-draft non-cancelled invoices for this client)
  const allClientInvoices = await prisma.invoice.findMany({
    where: {
      agencyId,
      clientId,
      docType: "FACTURE",
      status: { in: ["SENT", "EN_ATTENTE"] },
    },
    include: {
      payments: {
        where: { status: "APPROVED" },
        select: { amount: true },
      },
    },
  });

  const totalOutstanding = allClientInvoices.reduce((sum, inv) => {
    const paidSum = (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = Math.max(0, Number(inv.total || 0) - paidSum);
    return sum + due * Number(inv.exchangeRate || 1);
  }, 0);

  // 6. Ad Spend in this month
  const adSpendEntries = await prisma.adSpendEntry.findMany({
    where: {
      agencyId,
      clientId,
      month: monthStr,
    },
    orderBy: { createdAt: "asc" },
  });

  const formattedAdSpend = adSpendEntries.map((e) => {
    const spend = Number(e.actualSpend || 0);
    const billed = Number(e.amountBilled || 0);
    const orders = Number(e.orders || 0);
    const rev = Number(e.revenueGenerated || 0);
    const roas = spend > 0 ? Number((rev / spend).toFixed(2)) : 0;
    const cpa = orders > 0 ? Number((spend / orders).toFixed(2)) : 0;
    const margin = billed - spend;

    return {
      id: e.id,
      platform: e.platform,
      campaignName: e.campaignName,
      clientAdBudget: Number(e.clientAdBudget || 0),
      actualSpend: spend,
      amountBilled: billed,
      orders,
      revenueGenerated: rev,
      roas,
      cpa,
      agencyMargin: margin,
    };
  });

  let adSpendSummary = null;
  if (formattedAdSpend.length > 0) {
    const totalSpend = formattedAdSpend.reduce((sum, e) => sum + e.actualSpend, 0);
    const totalBilled = formattedAdSpend.reduce((sum, e) => sum + e.amountBilled, 0);
    const totalOrders = formattedAdSpend.reduce((sum, e) => sum + e.orders, 0);
    const totalRevenue = formattedAdSpend.reduce((sum, e) => sum + e.revenueGenerated, 0);
    const totalBudget = formattedAdSpend.reduce((sum, e) => sum + e.clientAdBudget, 0);

    adSpendSummary = {
      totalBudget: Number(totalBudget.toFixed(2)),
      totalSpend: Number(totalSpend.toFixed(2)),
      totalBilled: Number(totalBilled.toFixed(2)),
      totalOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgROAS: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
      avgCPA: totalOrders > 0 ? Number((totalSpend / totalOrders).toFixed(2)) : 0,
      agencyMargin: Number((totalBilled - totalSpend).toFixed(2)),
    };
  }

  // 7. Completed Tasks in the month
  const tasks = await prisma.task.findMany({
    where: {
      agencyId,
      clientId,
      status: "DONE",
      updatedAt: { gte: from, lte: to },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priority: true,
      updatedAt: true,
    },
  });

  // 8. Testili Product Tests in the month (or with activity in this month)
  const testiliTests = await prisma.testiliTest.findMany({
    where: {
      agencyId,
      clientId,
      OR: [
        { startDate: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
        { status: { in: ["RUNNING", "COMPLETED"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedTestili = testiliTests.map((t) => {
    const spend = Number(t.amountSpent || 0);
    const budget = Number(t.testBudget || 0);
    const orders = Number(t.orders || 0);
    const cpa =
      t.actualCPA != null ? Number(t.actualCPA) : orders > 0 ? Number((spend / orders).toFixed(2)) : null;

    return {
      id: t.id,
      productName: t.productName,
      productUrl: t.productUrl,
      platform: t.platform,
      testBudget: budget,
      amountSpent: spend,
      orders,
      targetCPA: t.targetCPA != null ? Number(t.targetCPA) : null,
      actualCPA: cpa,
      targetROAS: t.targetROAS != null ? Number(t.targetROAS) : null,
      actualROAS: t.actualROAS != null ? Number(t.actualROAS) : null,
      status: t.status,
      verdict: t.verdict,
      verdictNotes: t.verdictNotes,
    };
  });

  return {
    month: monthStr,
    from,
    to,
    client,
    agency,
    financials: {
      totalInvoiced: Number(totalInvoiced.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      invoices,
      payments: payments.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoice?.number,
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod,
        reference: p.reference,
        date: p.createdAt,
      })),
    },
    adSpend: {
      entries: formattedAdSpend,
      summary: adSpendSummary,
    },
    tasks,
    testili: formattedTestili,
  };
}

module.exports = {
  getClientMonthlyReport,
};
