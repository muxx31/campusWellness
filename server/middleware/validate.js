import { AppError } from "../utils/AppError.js";

export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return next(new AppError(400, issues[0].message, { errors: issues }));
    }
    req[source] = result.data; // only validated + stripped fields continue
    next();
  };
