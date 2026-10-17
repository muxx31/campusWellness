import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";

// Cache is best-effort: a Redis failure must never break a request.
export const cacheGet = async (key) => {
  try {
    const v = await redis.get(`cache:${key}`);
    return v ? JSON.parse(v) : null;
  } catch (err) {
    logger.warn({ err: err.message, key }, "cache get failed");
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds) => {
  try {
    await redis.set(`cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err: err.message, key }, "cache set failed");
  }
};

export const cacheDel = async (...keys) => {
  if (!keys.length) return;
  try {
    await redis.del(...keys.map((k) => `cache:${k}`));
  } catch (err) {
    logger.warn({ err: err.message, keys }, "cache del failed");
  }
};

export const getOrSet = async (key, ttlSeconds, loader) => {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
};

export const cacheKeys = {
  counselors: "counselors:list",
  user: (role, id) => `user:${role}:${id}`,
  studentBookings: (id) => `bookings:student:${id}`,
  counselorBookings: (id) => `bookings:counselor:${id}`,
};
