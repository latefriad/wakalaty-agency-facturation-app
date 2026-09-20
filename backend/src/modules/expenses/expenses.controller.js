const expensesService = require("./expenses.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    paginated(res, await expensesService.list(req.agencyId, req));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    success(res, await expensesService.create(req.agencyId, req.user.id, req.body, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await expensesService.update(req.agencyId, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await expensesService.remove(req.agencyId, req.params.id, req);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(Object.assign(new Error("Fichier requis (champ 'file')"), { status: 400 }));
    }
    success(res, await expensesService.setAttachment(req.agencyId, req.params.id, req.file, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.downloadAttachment = async (req, res, next) => {
  try {
    const { filePath, name } = await expensesService.getAttachmentFile(req.agencyId, req.params.id);
    res.download(filePath, name);
  } catch (err) {
    next(err);
  }
};
