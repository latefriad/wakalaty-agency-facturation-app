function parsePagination(req, maxLimit = 100) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const search = req.query.search || "";
  const skip = (page - 1) * limit;
  return { page, limit, search, skip };
}

module.exports = { parsePagination };
