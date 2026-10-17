import { redis } from "../config/redis.js";

// Live chat state lives in Redis (not process memory) so any instance can serve any room.
const CHAT_TTL = 24 * 60 * 60;
const MAX_BUFFER = 1000;

const chatKey = (room) => `chat:${room}`;

// `expireAtMs` = end of the session: the buffer disappears with the chat (retention policy).
export const appendMessage = async (room, message, expireAtMs) => {
  const tx = redis
    .multi()
    .rpush(chatKey(room), JSON.stringify(message))
    .ltrim(chatKey(room), -MAX_BUFFER, -1);
  if (expireAtMs) tx.pexpireat(chatKey(room), expireAtMs);
  else tx.expire(chatKey(room), CHAT_TTL);
  await tx.exec();
};

export const getRecentMessages = async (room, count = 100) => {
  const raw = await redis.lrange(chatKey(room), -count, -1);
  return raw.map((r) => JSON.parse(r));
};

export const getTranscript = (room) => getRecentMessages(room, MAX_BUFFER);

export const summaryKeys = {
  text: (room) => `summary:text:${room}`,
  count: (room) => `summary:count:${room}`,
};
