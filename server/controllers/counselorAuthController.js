import Counselor from "../models/Counselor.js";
import { startSession } from "../services/sessionService.js";
import { isApproved } from "../services/userService.js";
import { isLocked, recordFailure, clearFailures } from "../services/loginGuard.js";
import { getOrSet, cacheDel, cacheKeys } from "../services/cache.js";
import { env } from "../config/env.js";
import { AppError, asyncHandler } from "../utils/AppError.js";
import { burnPasswordCheck } from "../utils/dummyHash.js";

export const counselorSignup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await Counselor.exists({ email })) {
    throw new AppError(400, "Email already registered");
  }

  const needsApproval = env.COUNSELOR_SIGNUP_MODE === "approval";
  const counselor = await Counselor.create({
    name,
    email,
    password,
    status: needsApproval ? "pending" : "approved",
  });

  if (needsApproval) {
    // No session until an admin approves the account.
    return res.status(202).json({
      message: "Signup received. An administrator must approve your account before you can log in.",
      pendingApproval: true,
    });
  }

  await cacheDel(cacheKeys.counselors);
  const session = await startSession(res, "counselor", counselor);
  res.status(201).json({ message: "Signup successful", ...session });
});

export const counselorLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (await isLocked("counselor", email, req.ip)) {
    throw new AppError(429, "Too many failed attempts. Try again in 15 minutes.");
  }

  const counselor = await Counselor.findOne({ email });
  const ok = counselor
    ? await counselor.matchPassword(password)
    : await burnPasswordCheck(password);

  if (!counselor || !ok) {
    await recordFailure("counselor", email, req.ip);
    throw new AppError(401, "Invalid email or password");
  }
  if (!isApproved(counselor)) {
    throw new AppError(
      403,
      counselor.status === "rejected"
        ? "Your account was not approved."
        : "Your account is awaiting administrator approval."
    );
  }

  await clearFailures("counselor", email, req.ip);
  const session = await startSession(res, "counselor", counselor);
  res.status(200).json({ message: "Login successful", ...session });
});

// Public list used by students when booking. Cached: it changes rarely.
export const getCounselors = asyncHandler(async (req, res) => {
  const counselors = await getOrSet(cacheKeys.counselors, 60, () =>
    Counselor.find({ status: { $nin: ["pending", "rejected"] } })
      .select("_id name")
      .sort({ name: 1 })
      .lean()
  );
  res.set("Cache-Control", "public, max-age=30");
  res.status(200).json(counselors);
});
