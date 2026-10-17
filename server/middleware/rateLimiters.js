import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";

// Shared store: limits hold across every API instance.
const make = ({ name, windowMs, limit, message, ...rest }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    passOnStoreError: true, // if Redis is down, fail open (and log) rather than take the API down
    store: new RedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (...args) => redis.call(...args),
    }),
    handler: (req, res) =>
      res.status(429).json({ message, error: message }),
    ...rest,
  });

// Whole API: generous per-IP ceiling
export const apiLimiter = make({
  name: "api",
  windowMs: 60 * 1000,
  limit: 300,
  message: "Too many requests. Please slow down.",
});

// Login / signup / refresh: strict, failed logins only count
export const loginLimiter = make({
  name: "login",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Try again in 15 minutes.",
});

export const signupLimiter = make({
  name: "signup",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many signups from this address. Try again later.",
});

export const refreshLimiter = make({
  name: "refresh",
  windowMs: 60 * 1000,
  limit: 30,
  message: "Too many refresh attempts.",
});

// Per authenticated user (must run after `protect`)
export const bookingLimiter = make({
  name: "booking",
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `u:${req.user?._id ?? req.ip}`,
  message: "Booking limit reached. Try again later.",
});

logger.debug("rate limiters ready");
