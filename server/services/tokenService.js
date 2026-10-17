import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";

const REFRESH_TTL = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------------------------------------------------------------- access JWT
export const signAccessToken = ({ id, role }) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ id: String(id), role, jti }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
  return token;
};

// Throws on invalid / expired / revoked tokens.
export const verifyAccessToken = async (token) => {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (!payload.id || !payload.role || !payload.jti) {
    throw new Error("Malformed token");
  }
  if (await redis.exists(`bl:${payload.jti}`)) {
    throw new Error("Token revoked");
  }
  return payload;
};

// Revoke an access token until it would have expired anyway.
export const blacklistAccessToken = async (payload) => {
  const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  await redis.set(`bl:${payload.jti}`, "1", "EX", ttl);
};

// ------------------------------------------------------------- refresh token
// Opaque random value; only its hash is stored, so a Redis leak is not a session leak.
export const createRefreshToken = async ({ id, role }) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const hash = sha(raw);
  const owner = `${role}:${id}`;
  await redis
    .multi()
    .set(`rt:${hash}`, owner, "EX", REFRESH_TTL)
    .sadd(`rtu:${owner}`, hash)
    .expire(`rtu:${owner}`, REFRESH_TTL)
    .exec();
  return raw;
};

// Single-use: consumes the presented token atomically and returns its owner.
export const consumeRefreshToken = async (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const hash = sha(raw);
  const owner = await redis.getdel(`rt:${hash}`);
  if (!owner) return null;
  await redis.srem(`rtu:${owner}`, hash);
  const [role, id] = owner.split(":");
  return { role, id };
};

export const revokeRefreshToken = async (raw) => {
  if (raw) await consumeRefreshToken(raw);
};

export const revokeAllRefreshTokens = async ({ id, role }) => {
  const owner = `${role}:${id}`;
  const hashes = await redis.smembers(`rtu:${owner}`);
  if (hashes.length) {
    await redis.del(...hashes.map((h) => `rt:${h}`), `rtu:${owner}`);
  }
};
