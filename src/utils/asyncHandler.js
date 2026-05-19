/**
 * Async handler wrapper
 * Eliminates try/catch boilerplate in route controllers
 * @param {Function} fn - async controller function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
