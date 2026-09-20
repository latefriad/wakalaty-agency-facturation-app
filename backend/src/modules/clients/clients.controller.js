const clientsService = require("./clients.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await clientsService.list(req.agencyId, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await clientsService.getById(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.checkDuplicate = async (req, res, next) => {
  try {
    const { email, name, company, excludeId } = req.query;
    success(res, await clientsService.findDuplicates(req.agencyId, { email, name, company }, excludeId));
  } catch (err) {
    next(err);
  }
};

exports.listTags = async (req, res, next) => {
  try {
    success(res, await clientsService.listTags(req.agencyId));
  } catch (err) {
    next(err);
  }
};

exports.overview = async (req, res, next) => {
  try {
    const result = await clientsService.overview(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await clientsService.create(req.agencyId, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await clientsService.update(req.agencyId, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await clientsService.remove(req.agencyId, req.params.id);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};

exports.listNotes = async (req, res, next) => {
  try {
    success(res, await clientsService.listNotes(req.agencyId, req.params.id));
  } catch (err) {
    next(err);
  }
};

exports.addNote = async (req, res, next) => {
  try {
    const author = { id: req.user?.id, name: req.user?.name };
    success(res, await clientsService.addNote(req.agencyId, req.params.id, req.body, author), 201);
  } catch (err) {
    next(err);
  }
};

exports.removeNote = async (req, res, next) => {
  try {
    await clientsService.removeNote(req.agencyId, req.params.id, req.params.noteId);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
