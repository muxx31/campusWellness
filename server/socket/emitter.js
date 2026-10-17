import { Emitter } from "@socket.io/redis-emitter";
import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";

// Lets processes WITHOUT a Socket.IO server (the BullMQ worker, HTTP handlers)
// push events to connected clients through Redis.
export const emitter = new Emitter(redis);

export const disconnectUserSockets = async (userId) => {
  try {
    emitter.in(`user_${userId}`).disconnectSockets(true);
  } catch (err) {
    logger.warn({ err: err.message }, "could not disconnect user sockets");
  }
};
