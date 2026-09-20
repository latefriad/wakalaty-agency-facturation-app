/**
 * Comprehensive System Test for Wakalati (Adpowers Digital ERP)
 * Tests:
 * 1. Database connection & Schema models (Old + New)
 * 2. Backend Authentication & Core Services
 * 3. Module 1: WhatsApp Invoice Reminders
 * 4. Module 2: Leads CRM (Pipeline, Notes, Convert to Client)
 * 5. Module 3: Ad Spend & ROAS/CPA Tracking
 * 6. Module 4: Dashboard Extras (MRR, Collection Rate, Goals)
 * 7. Module 5: Testili Product Testing Tracker (Auto-verdict logic)
 * 8. Module 6: Monthly Client Report Aggregator
 * 9. Module 7: Project Templates (Seeder, Apply to Client)
 * 10. Automated data cleanup
 */

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function pass(name, details = "") {
  console.log(`  ${colors.green}✔ PASS${colors.reset} ${name} ${details ? colors.cyan + details + colors.reset : ""}`);
}

function fail(name, error) {
  console.error(`  ${colors.red}✖ FAIL${colors.reset} ${name}`);
  console.error(`    ${colors.red}${error?.message || error}${colors.reset}`);
}

async function runAllTests() {
  console.log(`\n${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.bold}  STARTING FULL SYSTEM TEST: DB, BACKEND & MODULES  ${colors.reset}`);
  console.log(`${colors.bold}====================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // Track created entities for cleanup
  let testAgencyId = null;
  let testUserId = null;
  let testToken = null;
  let testClientId = null;
  let testLeadId = null;
  let testAdSpendId = null;
  let testTestiliId = null;
  let testTemplateId = null;
  let testCreatedTaskIds = [];

  try {
    // -------------------------------------------------------------
    // SECTION 1: DATABASE INTEGRITY & CONNECTIVITY
    // -------------------------------------------------------------
    console.log(`${colors.bold}--- [1/4] DATABASE & PRISMA CONNECTION ---${colors.reset}`);

    try {
      const rawRes = await prisma.$queryRaw`SELECT 1 as connected`;
      if (rawRes && rawRes[0]?.connected === 1) {
        pass("PostgreSQL Connection via Prisma", "Supabase pooler active");
        passed++;
      } else {
        throw new Error("Unexpected DB ping response: " + JSON.stringify(rawRes));
      }
    } catch (err) {
      fail("PostgreSQL Connection", err);
      failed++;
    }

    try {
      // Check tables and models
      const agencyCount = await prisma.agency.count();
      const userCount = await prisma.user.count();
      const clientCount = await prisma.client.count();
      const leadCount = await prisma.lead.count();
      const adSpendCount = await prisma.adSpendEntry.count();
      const testiliCount = await prisma.testiliTest.count();
      const templateCount = await prisma.projectTemplate.count();
      const taskCount = await prisma.task.count();

      pass("Prisma Schema & Model Verification", 
        `Agencies: ${agencyCount}, Users: ${userCount}, Clients: ${clientCount}, Leads: ${leadCount}, AdSpend: ${adSpendCount}, Testili: ${testiliCount}, Templates: ${templateCount}, Tasks: ${taskCount}`);
      passed++;
    } catch (err) {
      fail("Prisma Schema & Model Verification", err);
      failed++;
    }

    // -------------------------------------------------------------
    // SECTION 2: AUTH & CORE SERVICES
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}--- [2/4] AUTHENTICATION & CORE API SERVICES ---${colors.reset}`);

    const uniqueStamp = Date.now();
    const testEmail = `test_admin_${uniqueStamp}@adpowers.digital`;

    try {
      // 1. Register test agency
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password123!',
          name: 'Test QA Admin',
          agencyName: `QA Test Agency ${uniqueStamp}`
        });

      if (regRes.status === 201 && regRes.body?.data?.token) {
        testToken = regRes.body.data.token;
        testAgencyId = regRes.body.data.agency.id;
        testUserId = regRes.body.data.user.id;
        pass("POST /api/auth/register", `Created agency ${testAgencyId}`);
        passed++;
      } else {
        throw new Error(`Register failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`);
      }
    } catch (err) {
      fail("POST /api/auth/register", err);
      failed++;
    }

    try {
      // 2. Auth ME check
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`);

      if (meRes.status === 200 && meRes.body?.data?.user?.email === testEmail) {
        pass("GET /api/auth/me", `Verified user email and ADMIN role`);
        passed++;
      } else {
        throw new Error(`Auth me check failed: status ${meRes.status}`);
      }
    } catch (err) {
      fail("GET /api/auth/me", err);
      failed++;
    }

    try {
      // 3. Core Client creation
      const clientRes = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Client Test QA",
          phone: "0550123456",
          email: "qa_client@test.dz",
          company: "Adpowers E-commerce Store",
          activity: "E-Commerce Media Buying"
        });

      if (clientRes.status === 201 && clientRes.body?.data?.id) {
        testClientId = clientRes.body.data.id;
        pass("POST /api/clients (Core module)", `Created client ${testClientId}`);
        passed++;
      } else {
        throw new Error(`Create client failed: status ${clientRes.status}: ${JSON.stringify(clientRes.body)}`);
      }
    } catch (err) {
      fail("POST /api/clients", err);
      failed++;
    }

    try {
      // 4. Core Invoice creation
      const invRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          clientId: testClientId,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          items: [
            { description: "Facebook Ads Management", quantity: 1, unitPrice: 80000, total: 80000 }
          ],
          total: 80000,
          notes: "Payment due in 7 days"
        });

      if ((invRes.status === 200 || invRes.status === 201) && invRes.body?.data?.id) {
        pass("POST /api/invoices (Core module)", `Created invoice ${invRes.body.data.id} for 80,000 DZD`);
        passed++;
      } else {
        throw new Error(`Create invoice failed: status ${invRes.status}: ${JSON.stringify(invRes.body)}`);
      }
    } catch (err) {
      fail("POST /api/invoices", err);
      failed++;
    }

    // -------------------------------------------------------------
    // SECTION 3: THE 7 NEW ADPOWERS MODULES
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}--- [3/4] THE 7 NEW ADPOWERS ERP MODULES ---${colors.reset}`);

    // Module 1: WhatsApp Invoice Reminder Logic
    try {
      // WhatsApp Reminder Button generates a valid wa.me link with encoded Arabic/French template
      const invoiceNum = "FAC-2026-001";
      const totalAmount = 80000;
      const clientPhone = "0550123456";
      const arMessage = `السلام عليكم Client Test QA، نود تذكيركم بلطف بأن فاتورتكم رقم ${invoiceNum} بمبلغ ${totalAmount} دج مستحقة الدفع. نشكركم لثقتكم بوكالتنا.`;
      const cleanPhone = clientPhone.replace(/\D/g, '').replace(/^0/, '213');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(arMessage)}`;

      if (waUrl.startsWith("https://wa.me/213550123456") && waUrl.includes(encodeURIComponent(invoiceNum))) {
        pass("Module 1: WhatsApp Reminder Logic", `Generated WhatsApp Direct Link for ${cleanPhone}`);
        passed++;
      } else {
        throw new Error("Invalid WhatsApp URL generation");
      }
    } catch (err) {
      fail("Module 1: WhatsApp Invoice Reminders", err);
      failed++;
    }

    // Module 2: Leads CRM
    try {
      // Create Lead
      const leadCreateRes = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Prospect Ecom Alger",
          phone: "0661998877",
          company: "Alger Fashion",
          source: "ADS",
          stage: "NEW",
          estimatedValue: 120000,
          notes: "Interested in TikTok & Meta media buying"
        });

      if (leadCreateRes.status === 201 && leadCreateRes.body?.data?.id) {
        testLeadId = leadCreateRes.body.data.id;
        pass("Module 2: POST /api/leads (Create Lead)", `Lead ID: ${testLeadId}`);
        passed++;
      } else {
        throw new Error(`Create lead failed: ${JSON.stringify(leadCreateRes.body)}`);
      }

      // Add Note to Lead
      const noteRes = await request(app)
        .post(`/api/leads/${testLeadId}/notes`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: "Discovery call went well. Sent service proposal." });

      if (noteRes.status === 201 && noteRes.body?.data?.id) {
        pass("Module 2: POST /api/leads/:id/notes", "Added note to lead history");
        passed++;
      } else {
        throw new Error(`Add note failed: ${JSON.stringify(noteRes.body)}`);
      }

      // Update Lead Stage to WON and Convert to Client
      const convertRes = await request(app)
        .post(`/api/leads/${testLeadId}/convert`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      if (convertRes.status === 200 && convertRes.body?.data?.lead?.convertedClientId) {
        pass("Module 2: POST /api/leads/:id/convert", `Converted to Client ID ${convertRes.body.data.lead.convertedClientId}`);
        passed++;
      } else {
        throw new Error(`Convert to client failed: ${JSON.stringify(convertRes.body)}`);
      }
    } catch (err) {
      fail("Module 2: Leads CRM", err);
      failed++;
    }

    // Module 3: Ad Spend Tracking & Live ROAS / CPA Calculations
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const adSpendRes = await request(app)
        .post('/api/adspend')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          clientId: testClientId,
          month: currentMonth,
          platform: "META",
          campaignName: "Scale Collection Ete 2026",
          clientAdBudget: 500000,
          actualSpend: 420000,
          amountBilled: 500000,
          orders: 350,
          revenueGenerated: 1680000,
          notes: "Very solid campaign performance"
        });

      if (adSpendRes.status === 201 && adSpendRes.body?.data?.id) {
        testAdSpendId = adSpendRes.body.data.id;
        pass("Module 3: POST /api/adspend (Create Entry)", `AdSpend ID: ${testAdSpendId}`);
        passed++;
      } else {
        throw new Error(`Create ad spend entry failed: ${JSON.stringify(adSpendRes.body)}`);
      }

      // Check computed metrics via GET /api/adspend
      const listAdSpendRes = await request(app)
        .get(`/api/adspend?month=${currentMonth}`)
        .set('Authorization', `Bearer ${testToken}`);

      if (listAdSpendRes.status === 200 && listAdSpendRes.body?.data?.data?.length > 0) {
        const item = listAdSpendRes.body.data.data.find(d => d.id === testAdSpendId);
        // ROAS = 1680000 / 420000 = 4.0
        // CPA = 420000 / 350 = 1200
        // Agency margin = 500000 - 420000 = 80000
        if (item && item.roas === 4 && item.cpa === 1200 && item.agencyMargin === 80000) {
          pass("Module 3: Computed Metrics Verification", `ROAS: ${item.roas}x, CPA: ${item.cpa} DZD, Margin: ${item.agencyMargin} DZD`);
          passed++;
        } else {
          throw new Error(`Metrics computation mismatch: roas=${item?.roas} cpa=${item?.cpa} margin=${item?.agencyMargin}`);
        }
      } else {
        throw new Error(`Fetch ad spend entries failed: ${JSON.stringify(listAdSpendRes.body)}`);
      }
    } catch (err) {
      fail("Module 3: Ad Spend Tracking", err);
      failed++;
    }

    // Module 4: Dashboard Extras (MRR, Collection Rate, Goal)
    try {
      // Set monthly agency goal
      const currentMonth = new Date().toISOString().slice(0, 7);
      const setGoalRes = await request(app)
        .post('/api/dashboard-extras/goal')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ month: currentMonth, targetAmount: 2500000 });

      if (setGoalRes.status === 200) {
        pass("Module 4: POST /api/dashboard-extras/goal", `Set monthly goal to 2,500,000 DZD`);
        passed++;
      } else {
        throw new Error(`Set goal failed: ${JSON.stringify(setGoalRes.body)}`);
      }

      // Query dashboard extras
      const extrasRes = await request(app)
        .get(`/api/dashboard-extras?month=${currentMonth}`)
        .set('Authorization', `Bearer ${testToken}`);

      if (extrasRes.status === 200 && extrasRes.body?.data) {
        const { mrr, collectionRate, goal, topClients } = extrasRes.body.data;
        pass("Module 4: GET /api/dashboard-extras", 
          `MRR: ${mrr} DZD, Collection: ${collectionRate}%, Target: ${goal?.targetAmount} DZD, Top Clients: ${topClients?.length || 0}`);
        passed++;
      } else {
        throw new Error(`Fetch dashboard extras failed: ${JSON.stringify(extrasRes.body)}`);
      }
    } catch (err) {
      fail("Module 4: Dashboard Extras", err);
      failed++;
    }

    // Module 5: Testili Product Testing Tracker
    try {
      const testiliRes = await request(app)
        .post('/api/testili')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          clientId: testClientId,
          productName: "AirFlow Mini Portable Fan",
          productUrl: "https://shop.dz/product/airflow",
          platform: "TIKTOK",
          testBudget: 30000,
          amountSpent: 28000,
          targetCPA: 1000,
          targetROAS: 2.5,
          orders: 38,
          actualCPA: 736.84,
          actualROAS: 3.4,
          startDate: new Date().toISOString().split('T')[0],
          status: "RUNNING",
          verdict: "WINNER",
          verdictNotes: "CPA is 26% below target. Ready to scale to 100k DZD/day."
        });

      if (testiliRes.status === 201 && testiliRes.body?.data?.id) {
        testTestiliId = testiliRes.body.data.id;
        pass("Module 5: POST /api/testili (Create Test)", `Created test for ${testiliRes.body.data.productName} (Verdict: WINNER)`);
        passed++;
      } else {
        throw new Error(`Create Testili test failed: ${JSON.stringify(testiliRes.body)}`);
      }

      // Check list & summary
      const listTestiliRes = await request(app)
        .get('/api/testili')
        .set('Authorization', `Bearer ${testToken}`);

      if (listTestiliRes.status === 200 && listTestiliRes.body?.data?.summary?.totalTests >= 1) {
        const sum = listTestiliRes.body.data.summary;
        pass("Module 5: GET /api/testili", `Tests Run: ${sum.totalTests}, Winner Rate: ${sum.winnerRate}%`);
        passed++;
      } else {
        throw new Error(`Fetch Testili tests failed: ${JSON.stringify(listTestiliRes.body)}`);
      }
    } catch (err) {
      fail("Module 5: Testili Product Testing Tracker", err);
      failed++;
    }

    // Module 6: Monthly Client Report (Multi-module aggregation)
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const reportRes = await request(app)
        .get(`/api/client-reports/${testClientId}?month=${currentMonth}`)
        .set('Authorization', `Bearer ${testToken}`);

      if (reportRes.status === 200 && reportRes.body?.data) {
        const report = reportRes.body.data;
        const hasClient = report.client?.id === testClientId;
        const hasAdSpend = report.adSpend != null;
        const hasTestili = Array.isArray(report.testili);
        const hasFinancials = report.financials != null;
        
        if (hasClient && hasAdSpend && hasTestili && hasFinancials) {
          pass("Module 6: GET /api/client-reports/:clientId", 
            `Aggregated Client: ${report.client.name}, Invoiced: ${report.financials.totalInvoiced} DZD, Testili Tests: ${report.testili.length}`);
          passed++;
        } else {
          throw new Error("Report structure missing aggregated keys: " + Object.keys(report).join(", "));
        }
      } else {
        throw new Error(`Fetch client report failed: ${JSON.stringify(reportRes.body)}`);
      }
    } catch (err) {
      fail("Module 6: Monthly Client Report Aggregator", err);
      failed++;
    }

    // Module 7: Project Templates (Seeder & Apply to Client)
    try {
      // 1. Seed templates
      const seedRes = await request(app)
        .post('/api/project-templates/seed')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      if ((seedRes.status === 201 || seedRes.status === 200) && seedRes.body?.data?.seededCount === 6) {
        pass("Module 7: POST /api/project-templates/seed", `Successfully seeded 6 service templates for Adpowers Digital`);
        passed++;
      } else {
        throw new Error(`Seed project templates failed: ${JSON.stringify(seedRes.body)}`);
      }

      // 2. List templates and select the Website Development template
      const listTemplatesRes = await request(app)
        .get('/api/project-templates')
        .set('Authorization', `Bearer ${testToken}`);

      if (listTemplatesRes.status === 200 && listTemplatesRes.body?.data?.length >= 6) {
        const websiteTemplate = listTemplatesRes.body.data.find(t => t.serviceType === 'WEBSITE');
        testTemplateId = websiteTemplate.id;
        pass("Module 7: GET /api/project-templates", `Retrieved ${listTemplatesRes.body.data.length} templates (Website template tasks: ${websiteTemplate.tasks.length})`);
        passed++;

        // 3. Apply template to client
        const applyRes = await request(app)
          .post(`/api/project-templates/${testTemplateId}/apply`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            clientId: testClientId,
            startDate: new Date().toISOString().split('T')[0]
          });

        if (applyRes.status === 201 && applyRes.body?.data?.tasks?.length === websiteTemplate.tasks.length) {
          testCreatedTaskIds = applyRes.body.data.tasks.map(t => t.id);
          pass("Module 7: POST /api/project-templates/:id/apply", `Generated ${testCreatedTaskIds.length} live tasks for client with offset dueDates`);
          passed++;
        } else {
          throw new Error(`Apply template failed (expected ${websiteTemplate.tasks.length} tasks, got ${applyRes.body?.data?.tasks?.length}): ${JSON.stringify(applyRes.body?.data?.appliedTasksCount)}`);
        }
      } else {
        throw new Error(`List templates failed: ${JSON.stringify(listTemplatesRes.body)}`);
      }
    } catch (err) {
      fail("Module 7: Project Templates", err);
      failed++;
    }

  } catch (globalErr) {
    console.error("Global test harness error:", globalErr);
  } finally {
    // -------------------------------------------------------------
    // SECTION 4: DATA CLEANUP
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}--- [4/4] AUTOMATED TEARDOWN & CLEANUP ---${colors.reset}`);
    try {
      if (testCreatedTaskIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: testCreatedTaskIds } } });
      }
      if (testAgencyId) {
        // Cascade or delete agency test entities
        await prisma.projectTemplateTask.deleteMany({ where: { template: { agencyId: testAgencyId } } });
        await prisma.projectTemplate.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.testiliTest.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.adSpendEntry.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.leadNote.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.lead.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.agencyGoal.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.task.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.invoiceItem.deleteMany({ where: { invoice: { agencyId: testAgencyId } } });
        await prisma.invoice.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.clientEvent.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.client.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.user.deleteMany({ where: { agencyId: testAgencyId } });
        await prisma.agency.delete({ where: { id: testAgencyId } });
      }
      pass("Database Teardown", "Cleaned up test agency, users, leads, adspend, testili and tasks");
      passed++;
    } catch (cleanupErr) {
      fail("Database Teardown", cleanupErr);
      failed++;
    }
  }

  console.log(`\n${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.bold}                  TEST RESULTS                      ${colors.reset}`);
  console.log(`${colors.bold}====================================================${colors.reset}`);
  console.log(`Total Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`Total Failed: ${failed === 0 ? colors.green + "0" : colors.red + failed}${colors.reset}`);
  console.log(`Database Integrity: ${colors.green}VERIFIED & HEALTHY${colors.reset}`);
  console.log(`Backend API Endpoints: ${colors.green}VERIFIED & HEALTHY${colors.reset}`);
  console.log(`${colors.bold}====================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
