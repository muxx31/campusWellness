// Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='a-long-passphrase' npm run seed:admin
import { env } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import Admin from "../models/Admin.js";

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars).");
  process.exit(1);
}

await connectDB();
const existing = await Admin.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
if (existing) {
  existing.password = env.ADMIN_PASSWORD;
  await existing.save();
  console.log("Admin password updated.");
} else {
  await Admin.create({ name: "Administrator", email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  console.log("Admin created.");
}
await disconnectDB();
process.exit(0);
