import Admin from "../models/Admin.js";
import Counselor from "../models/Counselor.js";
import { startSession } from "../services/sessionService.js";
import { invalidateUser } from "../services/userService.js";
import { revokeAllRefreshTokens } from "../services/tokenService.js";
import { isLocked, recordFailure, clearFailures } from "../services/loginGuard.js";
import { cacheDel, cacheKeys } from "../services/cache.js";
import { disconnectUserSockets } from "../socket/emitter.js";
import { env } from "../config/env.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { burnPasswordCheck } from "../utils/dummyHash.js";

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (await isLocked("admin", email, req.ip)) {
    throw new AppError(429, "Too many failed attempts. Try again in 15 minutes.");
  }

  const admin = await Admin.findOne({ email });
  const ok = admin
    ? await admin.matchPassword(password)
    : await burnPasswordCheck(password);
  if (!admin || !ok) {
    await recordFailure("admin", email, req.ip);
    throw new AppError(401, "Invalid email or password");
  }

  await clearFailures("admin", email, req.ip);
  const session = await startSession(res, "admin", admin);
  res.json({ message: "Login successful", ...session });
});

// GET /api/admin/counselors?status=pending
export const listCounselors = asyncHandler(async (req, res) => {
  const filter = {};
  if (["pending", "approved", "rejected"].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const counselors = await Counselor.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json(counselors);
});

// PATCH /api/admin/counselors/:id  { status }
export const setCounselorStatus = asyncHandler(async (req, res) => {
  const counselor = await Counselor.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  ).select("-password");
  if (!counselor) throw new AppError(404, "Counselor not found");

  await invalidateUser("counselor", counselor._id);
  await cacheDel(cacheKeys.counselors);
  if (counselor.status !== "approved") {
    await revokeAllRefreshTokens({ id: counselor._id, role: "counselor" });
    await disconnectUserSockets(counselor._id); // cut any live chat right away
  }
  res.json(counselor);
});
