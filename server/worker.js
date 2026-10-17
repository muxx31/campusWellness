// Dedicated BullMQ worker process: `node worker.js` (scale independently of the API).
import { logger } from "./config/logger.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { redis } from "./config/redis.js";
import { closeQueues } from "./queues/index.js";
import { startWorkers } from "./workers/index.js";

await connectDB();
const workers = startWorkers();

const shutdown = async (signal) => {
  logger.info(`${signal} received: draining worker`);
  setTimeout(() => process.exit(1), 15_000).unref();
  await workers.close(); // waits for in-flight jobs
  await closeQueues();
  await disconnectDB();
  await redis.quit();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
