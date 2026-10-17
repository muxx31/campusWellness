import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export const notFound = (req, res) =>
  res.status(404).json({ message: "Route not found", error: "Route not found" });

// `message` and `error` are both returned: the existing client reads either.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.code === 11000) {
    return res.status(409).json({ message: "Already exists", error: "Already exists" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large", error: "Payload too large" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON", error: "Invalid JSON" });
  }

  const status = err.status && err.expose ? err.status : 500;
  if (status >= 500) {
    (req.log || logger).error({ err }, "Unhandled error");
  }

  const message = status >= 500 ? "Internal server error" : err.message;
  res.status(status).json({
    message,
    error: message,
    ...(err.extra || {}),
    ...(env.isProd || status < 500 ? {} : { stack: err.stack }),
  });
};
