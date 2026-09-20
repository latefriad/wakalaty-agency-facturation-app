const crypto = require("crypto");
const prisma = require("../../config/database");
const { hashPassword, comparePassword } = require("../../utils/bcrypt");
const { signToken } = require("../../utils/jwt");
const { audit } = require("../../utils/audit");

async function register({ email, password, name, agencyName }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error("Email déjà utilisé"), { status: 409 });
  }

  const hashedPassword = await hashPassword(password);

  const { agency, user } = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: { name: agencyName || `${name}'s Agency`, email },
    });
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "ADMIN",
        agencyId: agency.id,
      },
    });
    return { agency, user };
  });

  const token = signToken({ userId: user.id, agencyId: agency.id, role: user.role });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    agency: { id: agency.id, name: agency.name, onboarded: agency.onboarded },
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { agency: true },
  });

  if (!user) {
    throw Object.assign(new Error("Identifiants incorrects"), { status: 401 });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw Object.assign(new Error("Identifiants incorrects"), { status: 401 });
  }

  const token = signToken({ userId: user.id, agencyId: user.agencyId, role: user.role });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    agency: { id: user.agency.id, name: user.agency.name, onboarded: user.agency.onboarded },
  };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { agency: true },
  });

  if (!user) {
    throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
    agency: {
      id: user.agency.id,
      name: user.agency.name,
      email: user.agency.email,
      phone: user.agency.phone,
      address: user.agency.address,
      logo: user.agency.logo,
      onboarded: user.agency.onboarded,
      primaryColor: user.agency.primaryColor,
      secondaryColor: user.agency.secondaryColor,
      currency: user.agency.currency,
      openingBalance: user.agency.openingBalance,
      },
  };
}

async function updateProfile(userId, { name, email }) {
  const data = {};
  if (name) data.name = name;
  if (email) data.email = email;

  const user = await prisma.user.update({ where: { id: userId }, data });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw Object.assign(new Error("Mot de passe actuel incorrect"), { status: 401 });

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}

// ─── Invitations (routes publiques) ─────────────────────────────────────
// Le token brut n'existe que dans le lien e-mail : on ne compare que son
// empreinte SHA-256. Lien inconnu → 404 ; déjà consommé ou expiré → 410.

async function findValidInvitation(token) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { agency: { select: { id: true, name: true } } },
  });
  if (!invitation) throw Object.assign(new Error("Invitation introuvable"), { status: 404 });
  if (invitation.usedAt) throw Object.assign(new Error("Invitation déjà utilisée"), { status: 410 });
  if (invitation.expiresAt < new Date()) throw Object.assign(new Error("Invitation expirée"), { status: 410 });
  return invitation;
}

async function invitationInfo(token) {
  const invitation = await findValidInvitation(token);
  return {
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    agencyName: invitation.agency.name,
    expiresAt: invitation.expiresAt,
  };
}

async function acceptInvitation(token, { password }) {
  const invitation = await findValidInvitation(token);

  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) throw Object.assign(new Error("Un compte existe déjà pour cet e-mail"), { status: 409 });

  const hashed = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    // Usage unique garanti atomiquement : seul le premier accept "gagne",
    // même en cas de double clic ou de lien rejoué en parallèle.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Invitation déjà utilisée"), { status: 410 });
    }

    const created = await tx.user.create({
      data: {
        email: invitation.email,
        password: hashed,
        name: invitation.name,
        role: invitation.role,
        agencyId: invitation.agencyId,
      },
    });

    // Pont User ↔ Employee (même logique que la création de compte admin).
    const employee = await tx.employee.findFirst({
      where: { agencyId: invitation.agencyId, userId: null, email: { equals: invitation.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (employee) {
      await tx.employee.update({ where: { id: employee.id }, data: { userId: created.id } });
    }

    return created;
  });

  audit({
    action: "INVITATION_ACCEPTED",
    agencyId: invitation.agencyId,
    actor: { id: user.id, email: user.email },
    targetType: "invitation",
    targetId: invitation.id,
  });

  const jwt = signToken({ userId: user.id, agencyId: user.agencyId, role: user.role });
  return {
    token: jwt,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    agency: { id: invitation.agency.id, name: invitation.agency.name },
  };
}

module.exports = { register, login, getMe, updateProfile, changePassword, invitationInfo, acceptInvitation };
