import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { io as connect } from "socket.io-client";

// Stub the LLM: the real worker + queue still run, only the network call is faked.
vi.mock("../services/aiSummaryService.js", () => ({
  generateSummary: vi.fn(async () => "Student reports exam stress."),
}));

import {
  api,
  app,
  auth,
  setup,
  reset,
  registerStudent,
  createApprovedCounselor,
  slotStartedMinutesAgo,
} from "./helpers.js";
import { initSocket } from "../socket/index.js";
import { startWorkers } from "../workers/index.js";
import Message from "../models/Message.js";
import Booking from "../models/Booking.js";

let server, io, workers, url;

beforeAll(async () => {
  await setup();
  server = createServer(app);
  io = initSocket(server);
  workers = startWorkers();
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await workers.close();
  await new Promise((r) => io.close(r));
});

beforeEach(reset);

const client = (token) =>
  new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

const once = (s, ev) => new Promise((r) => s.once(ev, r));

// Chat only works inside the strict 45-minute window, so sessions are booked relative to "now".
const setupSession = async (minutesAgo = 5) => {
  const { token: sToken } = await registerStudent();
  const { doc, token: cToken } = await createApprovedCounselor();
  const { date, time } = slotStartedMinutesAgo(minutesAgo);
  const res = await api()
    .post("/api/book")
    .set(auth(sToken))
    .send({ counselorId: String(doc._id), date, time });
  if (res.status !== 201) throw new Error(`booking failed: ${res.status} ${JSON.stringify(res.body)}`);
  const join = { counselorId: String(doc._id), date, time };
  return { sToken, cToken, join, booking: res.body.booking };
};

describe("socket chat", () => {
  it("rejects connections without a valid token", async () => {
    await expect(client("bad-token")).rejects.toThrow(/Invalid or expired token/);
  });

  it("delivers messages in a booking room, persists them via the queue, and pushes an AI summary to the counselor", async () => {
    const { sToken, cToken, join } = await setupSession();
    const student = await client(sToken);
    const counselor = await client(cToken);

    student.emit("join_room", join);
    counselor.emit("join_room", join);
    await Promise.all([once(student, "chat_history"), once(counselor, "chat_history")]);

    const gotMessage = once(counselor, "receive_message");
    const gotSummary = once(counselor, "receive_summary");
    student.emit("send_message", { text: "I'm very stressed about exams" });

    const msg = await gotMessage;
    // Students are anonymous: the counselor only ever sees a random alias
    expect(msg).toMatchObject({ role: "student", text: "I'm very stressed about exams" });
    expect(msg.alias).toMatch(/^Anon-[A-Z2-9]{6}$/);
    expect(JSON.stringify(msg)).not.toContain("S1001");

    // BullMQ persist worker writes it to MongoDB asynchronously
    await vi.waitFor(async () => expect(await Message.countDocuments()).toBe(1), { timeout: 8000 });

    // BullMQ summary worker (delayed job) pushes the summary through the Redis emitter
    const summary = await gotSummary;
    expect(summary.summary).toBe("Student reports exam stress.");

    student.close();
    counselor.close();
  });

  it("does not let a user join someone else's session, even by guessing the room id", async () => {
    const { join } = await setupSession();
    const { token: otherToken } = await registerStudent("S9999");

    const intruder = await client(otherToken);
    const err = once(intruder, "chat_error");
    intruder.emit("join_room", { ...join, roomId: "booking-whatever" });
    expect(await err).toMatch(/not authorized/i);

    // and cannot send into a room it never joined
    const err2 = once(intruder, "chat_error");
    intruder.emit("send_message", { text: "hello?" });
    expect(await err2).toMatch(/not in an authorized chat room/i);
    intruder.close();
  });

  it("rate limits message floods per socket", async () => {
    const { sToken, join } = await setupSession();
    const student = await client(sToken);
    student.emit("join_room", join);
    await once(student, "chat_history");

    const errors = [];
    student.on("chat_error", (e) => errors.push(e));
    for (let i = 0; i < 15; i++) student.emit("send_message", { text: `m${i}` });
    await vi.waitFor(() => expect(errors.some((e) => /too fast/i.test(e))).toBe(true), { timeout: 3000 });
    student.close();
  });

  it("disconnects live sockets when the user logs out", async () => {
    const { token, cookie } = await registerStudent();
    const s = await client(token);
    const closed = once(s, "disconnect");
    await api().post("/api/auth/logout").set(auth(token)).set("Cookie", cookie);
    await closed;
  });
  it("keeps students anonymous: counselors never receive the student id, name or reference", async () => {
    const { cToken, join } = await setupSession();
    const list = await api().get("/api/bookings/me").set(auth(cToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const b = list.body[0];
    expect(b.alias).toMatch(/^Anon-/);
    expect(b.student).toBeUndefined();
    const raw = JSON.stringify(list.body);
    expect(raw).not.toContain("S1001");
    expect(raw).not.toContain("Test Student");
    expect(b).toMatchObject({ counselor: join.counselorId });
  });

  it("refuses to open a chat before the session starts and after it has ended", async () => {
    // starts in 30 minutes
    const future = await setupSession(-30);
    const s1 = await client(future.sToken);
    const e1 = once(s1, "chat_error");
    s1.emit("join_room", future.join);
    expect(await e1).toMatch(/not started/i);
    s1.close();

    // started 50 minutes ago -> over (strict 45 minutes). The API refuses to create such a
    // booking, so insert it directly to simulate a session that has since ended.
    await reset();
    const { token: sToken2, user } = await registerStudent();
    const { doc } = await createApprovedCounselor();
    const slot = slotStartedMinutesAgo(50);
    await Booking.create({
      student: user.id,
      alias: user.alias,
      counselor: doc._id,
      counselorName: doc.name,
      ...slot,
    });
    const s2 = await client(sToken2);
    const e2 = once(s2, "chat_error");
    s2.emit("join_room", { counselorId: String(doc._id), ...slot });
    expect(await e2).toMatch(/ended/i);
    s2.close();
  });

  it("deletes chats with the session: every stored copy expires when the 45 minutes end", async () => {
    const { sToken, join, booking } = await setupSession(5);
    const student = await client(sToken);
    student.emit("join_room", join);
    await once(student, "chat_history");

    student.emit("send_message", { text: "this must not outlive the session" });
    await vi.waitFor(async () => expect(await Message.countDocuments()).toBe(1), { timeout: 8000 });

    // MongoDB: TTL timestamp = exactly the end of the session
    const stored = await Message.findOne().lean();
    const { sessionEnd } = await import("../utils/sessionTime.js");
    expect(new Date(stored.expireAt).getTime()).toBe(sessionEnd(join.date, join.time).getTime());
    expect(String(stored.booking)).toBe(String(booking._id));

    // Redis: the live buffer carries the same expiry (and a TTL of at most 45 minutes)
    const { redis } = await import("../config/redis.js");
    const ttl = await redis.pttl(`chat:booking-${booking._id}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(45 * 60 * 1000);
    student.close();
  });
});
