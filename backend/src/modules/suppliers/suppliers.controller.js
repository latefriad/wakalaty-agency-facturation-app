const suppliersService = require("./suppliers.service");
const { success } = require("../../utils/response");

exports.listSuppliers = async (req, res, next) => {
  try {
    success(res, await suppliersService.listSuppliers(req.agencyId));
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    success(res, await suppliersService.createSupplier(req.agencyId, req.body, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    success(res, await suppliersService.updateSupplier(req.agencyId, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.removeSupplier = async (req, res, next) => {
  try {
    await suppliersService.removeSupplier(req.agencyId, req.params.id, req);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};

exports.listBills = async (req, res, next) => {
  try {
    success(res, await suppliersService.listBills(req.agencyId, { status: req.query.status }));
  } catch (err) {
    next(err);
  }
};

exports.createBill = async (req, res, next) => {
  try {
    success(res, await suppliersService.createBill(req.agencyId, req.params.id, req.body, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.updateBill = async (req, res, next) => {
  try {
    success(res, await suppliersService.updateBill(req.agencyId, req.params.billId, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.payBill = async (req, res, next) => {
  try {
    success(res, await suppliersService.payBill(req.agencyId, req.user.id, req.params.billId, req));
  } catch (err) {
    next(err);
  }
};

exports.cancelBill = async (req, res, next) => {
  try {
    success(res, await suppliersService.cancelBill(req.agencyId, req.params.billId, req));
  } catch (err) {
    next(err);
  }
};
