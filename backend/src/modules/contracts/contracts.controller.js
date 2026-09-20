const contractsService = require("./contracts.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await contractsService.list(req.agencyId, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await contractsService.getById(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await contractsService.create(req.agencyId, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.generate = async (req, res, next) => {
  try {
    const { title, type, clientName, clientEmail, value, notes, startDate, endDate } = req.body;

    const generatedContent = `عقد خدمات تسويقية

المادة 1: موضوع العقد
يتعلق هذا العقد بـ ${title || "خدمات تسويقية"} المقدمة من الوكالة.

المادة 2: الأطراف
الوكالة: ${req.user?.agency?.name || "الوكالة"}
العميل: ${clientName || "العميل"}
البريد الإلكتروني: ${clientEmail || ""}

المادة 3: المدة
تاريخ البداية: ${startDate || new Date().toISOString().split("T")[0]}
تاريخ النهاية: ${endDate || "غير محدد"}

المادة 4: القيمة المالية
القيمة الإجمالية: ${value || 0} دج

المادة 5: الشروط العامة
${notes || "الشروط العامة المعتادة"}

تم إنشاء هذا العقد تلقائياً عبر منصة Wakalati`;

    const contract = await contractsService.create(req.agencyId, {
      title: title || "عقد مولّد",
      type: type || "MARKETING",
      value: value || 0,
      notes: generatedContent,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      clientId: req.body.clientId || null,
    });

    success(res, { contract, content: generatedContent }, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await contractsService.update(req.agencyId, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await contractsService.remove(req.agencyId, req.params.id);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
