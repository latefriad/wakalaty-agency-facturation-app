const prisma = require("../../config/database");

function computeSuggestedVerdict(test) {
  const actualROAS = test.actualROAS != null ? Number(test.actualROAS) : null;
  const targetROAS = test.targetROAS != null ? Number(test.targetROAS) : null;
  const actualCPA = test.actualCPA != null ? Number(test.actualCPA) : null;
  const targetCPA = test.targetCPA != null ? Number(test.targetCPA) : null;
  const amountSpent = Number(test.amountSpent || 0);
  const testBudget = Number(test.testBudget || 0);

  // WINNER if actualROAS >= targetROAS or actualCPA <= targetCPA
  const roasWinner = targetROAS != null && targetROAS > 0 && actualROAS != null && actualROAS >= targetROAS;
  const cpaWinner = targetCPA != null && targetCPA > 0 && actualCPA != null && actualCPA <= targetCPA;

  if (roasWinner || cpaWinner) {
    return "WINNER";
  }

  // else LOSER once the budget is fully spent
  if (testBudget > 0 && amountSpent >= testBudget) {
    return "LOSER";
  }

  if (amountSpent > 0 && testBudget > 0 && amountSpent >= 0.5 * testBudget) {
    return "NEEDS_MORE_DATA";
  }

  return "PENDING";
}

function formatTestiliTest(t, clientMap = {}) {
  const suggestedVerdict = computeSuggestedVerdict(t);
  const testBudget = Number(t.testBudget || 0);
  const amountSpent = Number(t.amountSpent || 0);
  const budgetUsedPercent =
    testBudget > 0 ? Number(Math.min(100, (amountSpent / testBudget) * 100).toFixed(1)) : 0;

  const orders = Number(t.orders || 0);
  const computedCPA = orders > 0 && amountSpent > 0 ? Number((amountSpent / orders).toFixed(2)) : null;
  const effectiveCPA = t.actualCPA != null ? Number(t.actualCPA) : computedCPA;

  const client = clientMap[t.clientId] || null;

  return {
    ...t,
    client: client ? { id: client.id, name: client.name, company: client.company } : null,
    suggestedVerdict,
    budgetUsedPercent,
    computedCPA,
    effectiveCPA,
  };
}

async function listTests(agencyId, query = {}) {
  const where = { agencyId };

  if (query.clientId) {
    where.clientId = query.clientId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.verdict) {
    where.verdict = query.verdict;
  }
  if (query.platform) {
    where.platform = query.platform;
  }
  if (query.search) {
    where.productName = {
      contains: query.search,
      mode: "insensitive",
    };
  }

  const tests = await prisma.testiliTest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Fetch client details for all referenced clientIds
  const clientIds = [...new Set(tests.map((t) => t.clientId).filter(Boolean))];
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds }, agencyId },
          select: { id: true, name: true, company: true },
        })
      : [];

  const clientMap = clients.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const formattedTests = tests.map((t) => formatTestiliTest(t, clientMap));

  // Compute summary stats across all matching tests
  const totalTests = formattedTests.length;
  const winnersCount = formattedTests.filter((t) => t.verdict === "WINNER").length;
  const losersCount = formattedTests.filter((t) => t.verdict === "LOSER").length;
  const pendingCount = formattedTests.filter((t) => t.verdict === "PENDING").length;
  const needsDataCount = formattedTests.filter((t) => t.verdict === "NEEDS_MORE_DATA").length;
  const winnerRate = totalTests > 0 ? Number(((winnersCount / totalTests) * 100).toFixed(1)) : 0;
  const totalBudget = formattedTests.reduce((sum, t) => sum + Number(t.testBudget || 0), 0);
  const totalSpent = formattedTests.reduce((sum, t) => sum + Number(t.amountSpent || 0), 0);

  return {
    tests: formattedTests,
    summary: {
      totalTests,
      winnersCount,
      losersCount,
      pendingCount,
      needsDataCount,
      winnerRate,
      totalBudget: Number(totalBudget.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
    },
  };
}

async function getTestById(agencyId, id) {
  const test = await prisma.testiliTest.findFirst({
    where: { id, agencyId },
  });
  if (!test) return null;

  let client = null;
  if (test.clientId) {
    client = await prisma.client.findFirst({
      where: { id: test.clientId, agencyId },
      select: { id: true, name: true, company: true },
    });
  }

  const clientMap = client ? { [client.id]: client } : {};
  return formatTestiliTest(test, clientMap);
}

async function createTest(agencyId, data, userId) {
  const {
    clientId,
    productName,
    productUrl,
    platform,
    testBudget,
    amountSpent,
    targetCPA,
    targetROAS,
    actualCPA,
    actualROAS,
    orders,
    startDate,
    endDate,
    status,
    verdict,
    verdictNotes,
  } = data;

  if (!productName || !productName.trim()) {
    throw new Error("Product name is required");
  }
  if (!clientId) {
    throw new Error("Client is required");
  }

  const test = await prisma.testiliTest.create({
    data: {
      agencyId,
      clientId,
      productName: productName.trim(),
      productUrl: productUrl ? productUrl.trim() : null,
      platform: platform === "TIKTOK" ? "TIKTOK" : "META",
      testBudget: Number(testBudget || 0),
      amountSpent: Number(amountSpent || 0),
      targetCPA: targetCPA != null && targetCPA !== "" ? Number(targetCPA) : null,
      targetROAS: targetROAS != null && targetROAS !== "" ? Number(targetROAS) : null,
      actualCPA: actualCPA != null && actualCPA !== "" ? Number(actualCPA) : null,
      actualROAS: actualROAS != null && actualROAS !== "" ? Number(actualROAS) : null,
      orders: Math.max(0, parseInt(orders || 0, 10)),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      status: status || "PLANNED",
      verdict: verdict || "PENDING",
      verdictNotes: verdictNotes || null,
      createdById: userId || null,
    },
  });

  return getTestById(agencyId, test.id);
}

async function updateTest(agencyId, id, data) {
  const existing = await prisma.testiliTest.findFirst({
    where: { id, agencyId },
  });
  if (!existing) {
    throw new Error("Test not found");
  }

  const updateData = {};
  if (data.productName !== undefined) updateData.productName = data.productName.trim();
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.productUrl !== undefined) updateData.productUrl = data.productUrl ? data.productUrl.trim() : null;
  if (data.platform !== undefined) updateData.platform = data.platform === "TIKTOK" ? "TIKTOK" : "META";
  if (data.testBudget !== undefined) updateData.testBudget = Number(data.testBudget || 0);
  if (data.amountSpent !== undefined) updateData.amountSpent = Number(data.amountSpent || 0);
  if (data.targetCPA !== undefined)
    updateData.targetCPA = data.targetCPA != null && data.targetCPA !== "" ? Number(data.targetCPA) : null;
  if (data.targetROAS !== undefined)
    updateData.targetROAS = data.targetROAS != null && data.targetROAS !== "" ? Number(data.targetROAS) : null;
  if (data.actualCPA !== undefined)
    updateData.actualCPA = data.actualCPA != null && data.actualCPA !== "" ? Number(data.actualCPA) : null;
  if (data.actualROAS !== undefined)
    updateData.actualROAS = data.actualROAS != null && data.actualROAS !== "" ? Number(data.actualROAS) : null;
  if (data.orders !== undefined) updateData.orders = Math.max(0, parseInt(data.orders || 0, 10));
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.verdict !== undefined) updateData.verdict = data.verdict;
  if (data.verdictNotes !== undefined) updateData.verdictNotes = data.verdictNotes;

  await prisma.testiliTest.update({
    where: { id },
    data: updateData,
  });

  return getTestById(agencyId, id);
}

async function updateVerdict(agencyId, id, { verdict, verdictNotes }) {
  const existing = await prisma.testiliTest.findFirst({
    where: { id, agencyId },
  });
  if (!existing) {
    throw new Error("Test not found");
  }

  const updateData = {};
  if (verdict) updateData.verdict = verdict;
  if (verdictNotes !== undefined) updateData.verdictNotes = verdictNotes;

  await prisma.testiliTest.update({
    where: { id },
    data: updateData,
  });

  return getTestById(agencyId, id);
}

async function deleteTest(agencyId, id) {
  const existing = await prisma.testiliTest.findFirst({
    where: { id, agencyId },
  });
  if (!existing) {
    throw new Error("Test not found");
  }

  await prisma.testiliTest.delete({
    where: { id },
  });

  return { success: true };
}

module.exports = {
  listTests,
  getTestById,
  createTest,
  updateTest,
  updateVerdict,
  deleteTest,
};
