const projectTemplatesService = require("./project-templates.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const templates = await projectTemplatesService.listTemplates(
      req.user.agencyId,
      req.query
    );
    success(res, templates);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const template = await projectTemplatesService.getTemplateById(
      req.user.agencyId,
      req.params.id
    );
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }
    success(res, template);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const template = await projectTemplatesService.createTemplate(
      req.user.agencyId,
      req.body
    );
    success(res, template, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const template = await projectTemplatesService.updateTemplate(
      req.user.agencyId,
      req.params.id,
      req.body
    );
    success(res, template);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await projectTemplatesService.deleteTemplate(
      req.user.agencyId,
      req.params.id
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.seed = async (req, res, next) => {
  try {
    const result = await projectTemplatesService.seedDefaultTemplates(req.user.agencyId);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.apply = async (req, res, next) => {
  try {
    const result = await projectTemplatesService.applyTemplate(
      req.user,
      req.params.id,
      req.body
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};
