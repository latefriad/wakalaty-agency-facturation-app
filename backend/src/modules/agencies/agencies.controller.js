const prisma = require("../../config/database");
const { success } = require("../../utils/response");

exports.getMe = async (req, res, next) => {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: req.agencyId },
    });
    success(res, agency);
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { name, email, phone, address, logo, tagline, website, primaryColor, secondaryColor, taxId, bankAccount, currency, remindersEnabled, onboarded, agencyType, teamSize, goals, openingBalance } = req.body;

    const agency = await prisma.agency.update({
      where: { id: req.agencyId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(logo !== undefined && { logo }),
        ...(tagline !== undefined && { tagline }),
        ...(website !== undefined && { website }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),
        ...(taxId !== undefined && { taxId }),
        ...(bankAccount !== undefined && { bankAccount }),
        ...(currency !== undefined && { currency }),
        ...(remindersEnabled !== undefined && { remindersEnabled }),
        ...(onboarded !== undefined && { onboarded }),
        ...(agencyType !== undefined && { agencyType }),
        ...(teamSize !== undefined && { teamSize }),
        ...(goals !== undefined && { goals }),
        ...(openingBalance !== undefined && { openingBalance }),
      },
    });

    success(res, agency);
  } catch (err) {
    next(err);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    const agency = await prisma.agency.update({
      where: { id: req.agencyId },
      data: { logo: logoUrl },
    });

    success(res, { logo: agency.logo });
  } catch (err) {
    next(err);
  }
};

