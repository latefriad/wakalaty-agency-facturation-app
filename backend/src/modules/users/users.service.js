const crypto = require("crypto");
const prisma = require("../../config/database");
const { hashPassword } = require("../../utils/bcrypt");
const { sendMail, isConfigured } = require("../../utils/mailer");
const { audit } = require("../../utils/audit");

const PUBLIC_FIELDS = { id: true, email: true, name: true, role: true, isActive: true, createdAt: true };

const INVITATION_TTL_HOURS = 72;

// Seule l'empreinte du token est stockée : voir le modèle Invitation.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function list(agencyId) {
  return prisma.user.findMany({
    where: { agencyId },
    select: PUBLIC_FIELDS,
    orderBy: { createdAt: "asc" },
  });
}

async function create(agencyId, { email, password, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error("Email déjà utilisé"), { status: 409 });

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, password: hashed, name, role, agencyId },
    select: PUBLIC_FIELDS,
  });

  // Pont User ↔ Employee : si une fiche employé de l'agence porte le même
  // e-mail et n'est pas encore reliée, ce compte devient son accès (les
  // tâches assignées à la fiche apparaissent dans "Mon travail").
  const employee = await prisma.employee.findFirst({
    where: { agencyId, userId: null, email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (employee) {
    await prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
  }

  return user;
}

async function update(agencyId, actorId, id, data) {
  const user = await prisma.user.findFirst({ where: { id, agencyId } });
  if (!user) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
  if (user.role === "SUPER_ADMIN") {
    throw Object.assign(new Error("Accès interdit"), { status: 403 });
  }
  // Un admin ne peut pas se rétrograder/désactiver lui-même : cela pourrait
  // laisser l'agence sans administrateur.
  if (id === actorId && (data.role !== undefined || data.isActive !== undefined)) {
    throw Object.assign(new Error("Impossible de modifier son propre rôle/statut"), { status: 400 });
  }

  return prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
}

// Invitation par e-mail : jamais de mot de passe transmis — l'invité définit
// le sien via un lien à usage unique expirant sous 72 h. Si le SMTP n'est pas
// configuré, le lien est renvoyé à l'admin (déjà habilité à créer des comptes,
// donc aucun privilège supplémentaire) pour partage manuel.
async function invite(agencyId, actor, { email, name, role }, req) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error("Email déjà utilisé"), { status: 409 });

  // Une seule invitation en attente par e-mail : ré-inviter révoque l'ancienne.
  await prisma.invitation.deleteMany({ where: { agencyId, email, usedAt: null } });

  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await prisma.invitation.create({
    data: {
      email,
      name,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000),
      agencyId,
      invitedById: actor.id,
    },
  });

  const base = (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
  const inviteUrl = `${base}/invitation/${token}`;

  let emailSent = false;
  if (isConfigured()) {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    await sendMail({
      to: email,
      subject: `Invitation à rejoindre ${agency?.name || "votre agence"} sur Wakalati`,
      html: `
        <p>Bonjour ${name},</p>
        <p><strong>${agency?.name || "Votre agence"}</strong> vous invite à créer votre compte sur Wakalati.</p>
        <p><a href="${inviteUrl}" style="background:#3b82f6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Créer mon compte</a></p>
        <p>Vous choisirez vous-même votre mot de passe. Ce lien est personnel, à usage unique et expire dans ${INVITATION_TTL_HOURS} heures.</p>
        <p style="color:#64748b;font-size:12px">Si vous n'attendiez pas cette invitation, ignorez cet e-mail.</p>
      `,
    });
    emailSent = true;
  }

  audit({
    action: "USER_INVITED",
    req,
    targetType: "invitation",
    targetId: invitation.id,
    details: { email, role, emailSent },
  });

  return {
    id: invitation.id,
    email,
    name,
    role,
    expiresAt: invitation.expiresAt,
    emailSent,
    ...(emailSent ? {} : { inviteUrl }),
  };
}

async function listInvitations(agencyId) {
  return prisma.invitation.findMany({
    where: { agencyId, usedAt: null },
    select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

async function revokeInvitation(agencyId, id, req) {
  const invitation = await prisma.invitation.findFirst({ where: { id, agencyId } });
  if (!invitation) throw Object.assign(new Error("Invitation introuvable"), { status: 404 });
  await prisma.invitation.delete({ where: { id } });
  audit({ action: "INVITATION_REVOKED", req, targetType: "invitation", targetId: id, details: { email: invitation.email } });
}

module.exports = { list, create, update, invite, listInvitations, revokeInvitation, hashToken };
