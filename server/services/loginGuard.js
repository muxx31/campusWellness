import { redis } from "../config/redis.js";

// Brute-force protection per (role, identifier, ip), on top of the IP rate limiter.
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;

const k = (role, identifier, ip) =>
  `lf:${role}:${String(identifier).toLowerCase()}:${ip}`;

export const isLocked = async (role, identifier, ip) => {
  const n = Number(await redis.get(k(role, identifier, ip)));
  return n >= MAX_FAILURES;
};

export const recordFailure = async (role, identifier, ip) => {
  const key = k(role, identifier, ip);
  await redis.multi().incr(key).expire(key, LOCK_SECONDS).exec();
};

export const clearFailures = (role, identifier, ip) =>
  redis.del(k(role, identifier, ip));
