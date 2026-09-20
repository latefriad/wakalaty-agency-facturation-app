function success(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function error(res, message = "Erreur interne", statusCode = 500) {
  return res.status(statusCode).json({ success: false, message });
}

function paginated(res, { data, total, page, limit }) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

module.exports = { success, error, paginated };
