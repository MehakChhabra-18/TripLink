/**
 * Standardized API response utilities
 */

/**
 * Send a success response
 * @param {import("express").Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {any}    data
 * @param {object} [meta]  - pagination, counts, etc.
 */
const sendSuccess = (res, statusCode = 200, message = "Success", data = null, meta = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {import("express").Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [code]
 * @param {any}    [details]
 */
const sendError = (res, statusCode = 500, message = "Internal server error", code = "ERROR", details = null) => {
  const response = { success: false, message, code };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
};

/**
 * Build paginated metadata
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
const buildMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext:    page * limit < total,
  hasPrev:    page > 1,
});

module.exports = { sendSuccess, sendError, buildMeta };
