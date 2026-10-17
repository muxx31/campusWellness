import { Queue } from "bullmq";
import { createBullConnection } from "../config/redis.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const SUMMARY_QUEUE = "chat-summary";
export const PERSIST_QUEUE = "chat-persist";

const connection = createBullConnection("queue");

const common = { connection };

export const summaryQueue = new Queue(SUMMARY_QUEUE, {
  ...common,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true, // frees the dedupe jobId so the next message can schedule again
  },
});

export const persistQueue = new Queue(PERSIST_QUEUE, {
  ...common,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: { count: 1000 }, // keep failures for inspection
  },
});

for (const q of [summaryQueue, persistQueue]) {
  q.on("error", (err) => logger.error({ err: err.message, queue: q.name }, "queue error"));
}

// One delayed summary job per room: a fixed jobId makes BullMQ ignore duplicate adds,
// so a burst of messages produces a single summary (replaces the old per-room setInterval).
export const scheduleSummary = (room, expireAtMs) =>
  summaryQueue.add(
    "summarize",
    { room, expireAtMs },
    { jobId: `summary-${room}`, delay: env.SUMMARY_DELAY_MS }
  );

export const enqueuePersist = (message) => persistQueue.add("persist", message);

export const closeQueues = () => Promise.all([summaryQueue.close(), persistQueue.close()]);
