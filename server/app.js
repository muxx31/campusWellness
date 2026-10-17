import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import pinoHttp from "pino-http";
import mongoose from "mongoose";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { isRedisReady } from "./config/redis.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import counselorAuthRoutes from "./routes/counselorAuthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY); // correct client IPs behind nginx / a PaaS proxy
  app.use(helmet());


  // --- health probes (before logging / limits so orchestrators can poll freely)
  app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.get("/ping", (req, res) => res.send("pong"));
  app.get("/ready", async (req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    const redisOk = await isRedisReady();
    res.status(mongoOk && redisOk ? 200 : 503).json({
      status: mongoOk && redisOk ? "ready" : "unavailable",
      mongo: mongoOk,
      redis: redisOk,
    });
  });

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  app.use(
    cors({
      origin(origin, cb) {
        // no Origin header = same-origin / curl / health checks
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ and . operators -> blocks NoSQL injection
  app.use(hpp()); // HTTP parameter pollution

  app.use("/api", apiLimiter);

  app.use("/api/auth", authRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api/student", studentAuthRoutes);
  app.use("/api/counselorAuth", counselorAuthRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
