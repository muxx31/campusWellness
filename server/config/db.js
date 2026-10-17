import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

export const connectDB = async () => {
  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });
  logger.info("Connected to MongoDB");
};

export const disconnectDB = () => mongoose.disconnect();
