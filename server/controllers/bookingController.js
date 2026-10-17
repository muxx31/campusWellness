import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import Counselor from "../models/Counselor.js";
import { redis } from "../config/redis.js";
import { getOrSet, cacheDel, cacheKeys } from "../services/cache.js";
import { isApproved } from "../services/userService.js";
import { ensureAlias } from "../services/aliasService.js";
import { SESSION_DURATION_MS, sessionStart, withTiming } from "../utils/sessionTime.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

export { SESSION_DURATION_MS };

// ---- Redis lock: makes "check for conflict, then insert" atomic across instances
const RELEASE = `if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`;

const withLock = async (key, fn) => {
  const token = crypto.randomUUID();
  const acquired = await redis.set(key, token, "PX", 10000, "NX");
  if (!acquired) {
    throw new AppError(409, "Another booking for this counselor is in progress. Please retry.");
  }
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE, 1, key, token).catch(() => {});
  }
};

export const createBooking = asyncHandler(async (req, res) => {
  const { counselorId, date, time, issue } = req.body;

  const counselor = await Counselor.findById(counselorId);
  if (!counselor || !isApproved(counselor)) {
    throw new AppError(404, "Counselor not found");
  }

  // Wall-clock time in SESSION_TZ -> real instant (null for impossible dates)
  const newStart = sessionStart(date, time);
  if (!newStart) throw new AppError(400, "Invalid date or time");
  const newEnd = new Date(newStart.getTime() + SESSION_DURATION_MS);

  // Sessions are strictly 45 minutes: a slot that is already over cannot be booked.
  if (newEnd.getTime() <= Date.now()) {
    throw new AppError(400, "That time slot has already passed. Please choose a later time.");
  }

  // Anonymous identity shown to the counselor (never the real student ID)
  const alias = await ensureAlias(req.user);

  const booking = await withLock(`lock:booking:${counselor._id}:${date}`, async () => {
    const existing = await Booking.find({ counselor: counselor._id, date }).lean();

    // Two intervals overlap when newStart < existingEnd && newEnd > existingStart
    const conflict = existing.some((b) => {
      const s = sessionStart(b.date, b.time);
      return (
        s && newStart < new Date(s.getTime() + SESSION_DURATION_MS) && newEnd > s
      );
    });
    if (conflict) {
      throw new AppError(
        409,
        "This counselor already has a session during the selected time. Please choose another time."
      );
    }

    return Booking.create({
      student: req.user._id, // identity comes only from the verified JWT
      alias,
      counselor: counselor._id,
      counselorName: counselor.name,
      date,
      time,
      issue,
    });
  });

  await cacheDel(
    cacheKeys.studentBookings(req.user._id),
    cacheKeys.counselorBookings(counselor._id)
  );

  res.status(201).json({ message: "Booking successful", booking: withTiming(booking.toObject()) });
});

// `select` hides fields a given role must not see.
const list = (field, keyFn, select = "") =>
  asyncHandler(async (req, res) => {
    const bookings = await getOrSet(keyFn(req.user._id), 30, () => {
      const q = Booking.find({ [field]: req.user._id });
      if (select) q.select(select);
      return q.sort({ date: 1, time: 1 }).limit(500).lean();
    });
    // startAt/endAt come from the server so every client agrees on the session window
    res.status(200).json(bookings.map(withTiming));
  });

// Counselors never receive the student reference: only the anonymous alias.
export const myCounselorBookings = list("counselor", cacheKeys.counselorBookings, "-student");
export const myStudentBookings = list("student", cacheKeys.studentBookings);
