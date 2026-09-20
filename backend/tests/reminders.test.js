// Mock du mailer AVANT tout import : le job ne part que si isConfigured() est
// vrai, et on capture les e-mails plutôt que de les envoyer.
jest.mock("../src/utils/mailer", () => ({
  isConfigured: () => true,
  sendMail: jest.fn().mockResolvedValue({ messageId: "test" }),
}));

const { app, request, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");
const { sendMail } = require("../src/utils/mailer");
const { sendReminders } = require("../src/jobs/sendReminders");

afterAll(() => prisma.$disconnect());
beforeEach(() => sendMail.mockClear());

async function createInvoice(token, clientId, extra) {
  const res = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({ clientId, items: [{ description: "Prestation", quantity: 1, unitPrice: 1000 }], ...extra });
  return res.body.data;
}

const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

describe("Relances d'impayés", () => {
  test("rappel de courtoisie AVANT échéance : une seule fois, dans la fenêtre", async () => {
    const { token } = await createAgency();
    const client = await createClient(token, { email: "client@test.wakalati" });
    // Échéance dans 2 jours → dans la fenêtre par défaut (reminderLeadDays=3).
    const inv = await createInvoice(token, client.id, { dueDate: daysFromNow(2) });

    await sendReminders();
    const subjects = sendMail.mock.calls.map((c) => c[0].subject);
    expect(subjects.some((s) => s.includes(inv.number) && /sous \d+ jour/.test(s))).toBe(true);

    const row = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(row.preReminderAt).not.toBeNull();

    // Deuxième passe : pas de nouveau rappel pré-échéance pour cette facture.
    sendMail.mockClear();
    await sendReminders();
    const again = sendMail.mock.calls.map((c) => c[0].subject);
    expect(again.some((s) => s.includes(inv.number) && /sous \d+ jour/.test(s))).toBe(false);
  });

  test("relance APRÈS échéance : facture échue et impayée", async () => {
    const { token } = await createAgency();
    const client = await createClient(token, { email: "client@test.wakalati" });
    const inv = await createInvoice(token, client.id, { dueDate: "2020-01-01" });

    await sendReminders();
    const subjects = sendMail.mock.calls.map((c) => c[0].subject);
    expect(subjects.some((s) => s.includes(inv.number) && s.includes("en attente de paiement"))).toBe(true);

    const row = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(row.lastReminderAt).not.toBeNull();
  });

  test("pas de relance quand les rappels sont désactivés pour l'agence", async () => {
    const { token, agency } = await createAgency();
    await prisma.agency.update({ where: { id: agency.id }, data: { remindersEnabled: false } });
    const client = await createClient(token, { email: "client@test.wakalati" });
    const inv = await createInvoice(token, client.id, { dueDate: "2020-01-01" });

    await sendReminders();
    const subjects = sendMail.mock.calls.map((c) => c[0].subject);
    expect(subjects.some((s) => s.includes(inv.number))).toBe(false);
  });
});
