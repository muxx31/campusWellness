import { createServer } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { redis } from "./config/redis.js";
import { createApp } from "./app.js";
import { initSocket } from "./socket/index.js";
import { closeQueues } from "./queues/index.js";
import { startWorkers } from "./workers/index.js";

await connectDB(); // fail fast: the orchestrator restarts us if the DB is unreachable

const app = createApp();
const server = createServer(app);
const io = initSocket(server);

// Free-tier hosts often can't run a second process: EMBEDDED_WORKER=true runs the
// BullMQ workers inside the API process instead of the separate `worker.js`.
const workers = env.EMBEDDED_WORKER ? startWorkers() : null;

// Longer than typical proxy/LB idle timeouts, avoids sporadic 502s
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(env.PORT, () =>
  logger.info(`API + Socket.IO listening on :${env.PORT} (${env.NODE_ENV})`)
);

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received: shutting down gracefully`);

  const force = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 15_000);
  force.unref();

  try {
    await new Promise((resolve) => io.close(resolve)); // closes sockets + http server
    await workers?.close();
    await closeQueues();
    await disconnectDB();
    await redis.quit();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  process.exit(1);
});
