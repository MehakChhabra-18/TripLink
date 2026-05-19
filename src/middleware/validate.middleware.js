/**
 * Validation Middleware Factory
 * Validates req.body / req.params / req.query against a Zod schema
 * Returns 400 with detailed field errors on failure
 */
const { ZodError } = require("zod");
const { sendError } = require("../utils/response");

/**
 * @param {import("zod").ZodSchema} schema  - Zod schema to validate against
 * @param {"body"|"params"|"query"} source  - Which part of req to validate
 */
const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field:   e.path.join("."),
      message: e.message,
    }));

    return sendError(res, 400, "Validation failed", "VALIDATION_ERROR", details);
  }

  // Replace source with parsed & coerced values
  req[source] = result.data;
  next();
};

module.exports = { validate };
