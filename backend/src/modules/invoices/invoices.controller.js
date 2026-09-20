const invoicesService = require("./invoices.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await invoicesService.list(req.agencyId, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await invoicesService.getById(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await invoicesService.create(req.agencyId, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.finalize = async (req, res, next) => {
  try {
    const result = await invoicesService.finalize(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const result = await invoicesService.updateStatus(req.agencyId, req.params.id, req.body.status);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.addPayment = async (req, res, next) => {
  try {
    const result = await invoicesService.addPayment(req.agencyId, req.params.id, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.convertToInvoice = async (req, res, next) => {
  try {
    const result = await invoicesService.convertToInvoice(req.agencyId, req.params.id);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.sendToClient = async (req, res, next) => {
  try {
    success(res, await invoicesService.sendToClient(req.agencyId, req.params.id));
  } catch (err) {
    next(err);
  }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const csv = await invoicesService.exportCsv(req.agencyId, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="factures-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await invoicesService.remove(req.agencyId, req.params.id);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
