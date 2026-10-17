import Student from "../models/Student.js";
import Counselor from "../models/Counselor.js";
import Admin from "../models/Admin.js";
import { cacheDel, cacheGet, cacheSet, cacheKeys } from "./cache.js";
import { AppError } from "../utils/AppError.js";

export const MODELS = { student: Student, counselor: Counselor, admin: Admin };

export const isApproved = (u) => !u.status || u.status === "approved";

// Auth lookups happen on every request: serve them from Redis (5 min TTL).
export const loadUser = async (role, id) => {
  const Model = MODELS[role];
  if (!Model) throw new AppError(401, "Invalid user role");

  const key = cacheKeys.user(role, id);
  let user = await cacheGet(key);

  if (!user) {
    user = await Model.findById(id).select("-password").lean();
    if (!user) throw new AppError(401, `${role} not found`);
    user = JSON.parse(JSON.stringify(user)); // normalise ObjectId/Date -> string
    await cacheSet(key, user, 300);
  }

  if (role === "counselor" && !isApproved(user)) {
    throw new AppError(403, "Counselor account is not approved");
  }
  return user;
};

export const invalidateUser = (role, id) => cacheDel(cacheKeys.user(role, String(id)));

export const publicUser = (role, u) => {
  const base = { id: String(u._id), role, name: u.name };
  if (role === "student") {
    base.studentId = u.studentId; // the student's own login ID (never shown to counselors)
    if (u.alias) base.alias = u.alias; // their anonymous identity
  }
  else base.email = u.email;
  return base;
};
