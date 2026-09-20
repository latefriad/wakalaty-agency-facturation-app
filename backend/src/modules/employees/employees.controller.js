const employeesService = require("./employees.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await employeesService.list(req.agencyId, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.listAssignable = async (req, res, next) => {
  try {
    const result = await employeesService.listAssignable(req.agencyId);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const result = await employeesService.getMyProfile(req.agencyId, req.user.id, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getMyCommissions = async (req, res, next) => {
  try {
    const result = await employeesService.getMyCommissions(req.agencyId, req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await employeesService.getById(req.agencyId, req.params.id, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await employeesService.create(req.agencyId, req.body, req);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await employeesService.update(req.agencyId, req.params.id, req.body, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.offboard = async (req, res, next) => {
  try {
    const result = await employeesService.offboard(req.agencyId, req.params.id, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.reactivate = async (req, res, next) => {
  try {
    const result = await employeesService.reactivate(req.agencyId, req.params.id, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await employeesService.remove(req.agencyId, req.params.id, req);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};

exports.listDocuments = async (req, res, next) => {
  try {
    success(res, await employeesService.listDocuments(req.agencyId, req.params.id));
  } catch (err) {
    next(err);
  }
};

exports.listMyDocuments = async (req, res, next) => {
  try {
    success(res, await employeesService.listMyDocuments(req.agencyId, req.user.id));
  } catch (err) {
    next(err);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(Object.assign(new Error("Fichier requis (champ 'file')"), { status: 400 }));
    }
    success(res, await employeesService.addDocument(req.agencyId, req.params.id, req.file, req.body.name, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.downloadDocument = async (req, res, next) => {
  try {
    const { filePath, name } = await employeesService.getDocumentFile(
      req.agencyId,
      req.params.docId,
      { employeeId: req.params.id },
      req
    );
    res.download(filePath, name);
  } catch (err) {
    next(err);
  }
};

exports.downloadMyDocument = async (req, res, next) => {
  try {
    const { filePath, name } = await employeesService.getDocumentFile(
      req.agencyId,
      req.params.docId,
      { ownerUserId: req.user.id },
      req
    );
    res.download(filePath, name);
  } catch (err) {
    next(err);
  }
};

exports.removeDocument = async (req, res, next) => {
  try {
    await employeesService.removeDocument(req.agencyId, req.params.id, req.params.docId, req);
    success(res, { message: "Document supprimé" });
  } catch (err) {
    next(err);
  }
};
