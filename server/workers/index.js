import { Worker } from "bullmq";
import Message from "../models/Message.js";
import { createBullConnection, redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { SUMMARY_QUEUE, PERSIST_QUEUE } from "../queues/index.js";
import { getTranscript, summaryKeys } from "../services/chatService.js";
import { generateSummary } from "../services/aiSummaryService.js";
import { emitter } from "../socket/emitter.js";

const DAY = 24 * 60 * 60;

// Generates (at most) one summary per room per run and pushes it to the counselor.
const summaryProcessor = async (job) => {
  const { room, expireAtMs } = job.data;
  // The conversation (and its summary) is deleted when the session ends: never outlive it.
  if (expireAtMs && expireAtMs <= Date.now()) return { skipped: "session ended" };
  const messages = await getTranscript(room);
  if (messages.length === 0) return { skipped: "empty" };

  const last = Number(await redis.get(summaryKeys.count(room)));
  if (last === messages.length) return { skipped: "no new messages" };

  const summary = await generateSummary(messages); // throws -> BullMQ retries with backoff

  const tx = redis.multi();
  if (expireAtMs) {
    tx.set(summaryKeys.text(room), summary, "PXAT", expireAtMs);
    tx.set(summaryKeys.count(room), messages.length, "PXAT", expireAtMs);
  } else {
    tx.set(summaryKeys.text(room), summary, "EX", DAY);
    tx.set(summaryKeys.count(room), messages.length, "EX", DAY);
  }
  await tx.exec();

  emitter.to(`counselor_${room}`).emit("receive_summary", { roomId: room, summary });
  return { messages: messages.length };
};

// Idempotent insert: a retried job can never create a duplicate message.
const persistProcessor = async (job) => {
  const { _id, ...data } = job.data;
  // Retention = chat duration: never store a message whose session is already over.
  if (new Date(data.expireAt).getTime() <= Date.now()) return { skipped: "session ended" };
  await Message.updateOne({ _id }, { $setOnInsert: data }, { upsert: true });
};

export const startWorkers = () => {
  const connection = createBullConnection("worker");

  const summaryWorker = new Worker(SUMMARY_QUEUE, summaryProcessor, {
    connection,
    concurrency: 3,
    // stay under the LLM provider's rate limit
    limiter: { max: 20, duration: 60_000 },
  });

  const persistWorker = new Worker(PERSIST_QUEUE, persistProcessor, {
    connection,
    concurrency: 10,
  });

  for (const w of [summaryWorker, persistWorker]) {
    w.on("failed", (job, err) =>
      logger.error(
        { queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
        "job failed"
      )
    );
    w.on("error", (err) => logger.error({ queue: w.name, err: err.message }, "worker error"));
  }

  logger.info("BullMQ workers started");
  return {
    close: () => Promise.all([summaryWorker.close(), persistWorker.close()]),
  };
};
