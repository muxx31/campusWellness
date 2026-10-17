import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { generateAlias } from "../utils/alias.js";

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    // Anonymous identity shown to counselors, in chat and to the AI. Random, so it can
    // never be traced back to studentId/name. `sparse`: legacy students get one lazily
    // (see services/aliasService.js) or via `npm run migrate:anonymize`.
    alias: { type: String, unique: true, sparse: true, default: generateAlias },
  },
  { timestamps: true }
);

studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
  next();
});

studentSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model("Student", studentSchema);
