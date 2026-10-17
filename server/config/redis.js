import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

const attach = (client, name) => {
  client.on("error", (err) =>
    logger.error({ err: err.message }, `redis(${name}) error`)
  );
  return client;
};

// General purpose client (cache, tokens, locks, rate limits, chat buffers)
export const redis = attach(
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }),
  "main"
);

// BullMQ requires maxRetriesPerRequest = null on its connections
export const createBullConnection = (name = "bull") =>
  attach(new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }), name);

// Socket.IO adapter needs dedicated pub/sub clients
export const createPubSub = () => {
  const pub = attach(new Redis(env.REDIS_URL), "pub");
  const sub = attach(pub.duplicate(), "sub");
  return { pub, sub };
};

export const isRedisReady = async () => {
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
};
