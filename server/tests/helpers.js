import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../app.js";
import { connectDB } from "../config/db.js";
import { redis } from "../config/redis.js";
import Student from "../models/Student.js";
import Counselor from "../models/Counselor.js";
import Admin from "../models/Admin.js";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";

export const app = createApp();
export const api = () => request(app);

export const setup = async () => {
  if (mongoose.connection.readyState !== 1) await connectDB();
};

// Clean slate between tests (Redis db 1 is dedicated to tests)
export const reset = async () => {
  // Clear app keys but leave BullMQ's own keys alone (workers may be running)
  const keys = (await redis.keys("*")).filter((k) => !k.startsWith("bull:"));
  if (keys.length) await redis.del(...keys);
  await Promise.all([
    Student.deleteMany({}),
    Counselor.deleteMany({}),
    Admin.deleteMany({}),
    Booking.deleteMany({}),
    Message.deleteMany({}),
  ]);
};

export const registerStudent = async (studentId = "S1001", password = "Passw0rd!x") => {
  const res = await api()
    .post("/api/student/register")
    .send({ studentId, name: "Test Student", password });
  return { res, token: res.body.token, user: res.body.user, cookie: res.headers["set-cookie"] };
};

// Counselors normally need admin approval; tests insert an approved one directly.
export const createApprovedCounselor = async (email = "c@campus.test", password = "Passw0rd!x") => {
  const doc = await Counselor.create({ name: "Dr Test", email, password, status: "approved" });
  const res = await api().post("/api/counselorAuth/login").send({ email, password });
  return { doc, res, token: res.body.token };
};

export const createAdmin = async (email = "admin@campus.test", password = "AdminPassw0rd!!") => {
  await Admin.create({ name: "Admin", email, password });
  const res = await api().post("/api/admin/login").send({ email, password });
  return { token: res.body.token };
};

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

// A {date, time} slot (wall-clock in SESSION_TZ) whose 45-minute window started
// `minutesAgo` minutes ago (negative = starts in the future). minutesAgo=5 -> active now.
export const slotStartedMinutesAgo = (minutesAgo) => {
  const tz = process.env.SESSION_TZ || "Asia/Kolkata";
  const t = new Date(Date.now() - minutesAgo * 60000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(t)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};
