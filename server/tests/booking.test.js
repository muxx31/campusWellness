import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, auth, setup, reset, registerStudent, createApprovedCounselor } from "./helpers.js";

beforeAll(setup);
beforeEach(reset);

const book = (token, counselorId, time, date = "2030-01-15") =>
  api().post("/api/book").set(auth(token)).send({ counselorId, date, time, issue: "stress" });

describe("bookings", () => {
  it("creates a booking and shows it to both parties", async () => {
    const { token } = await registerStudent();
    const { doc, token: cToken } = await createApprovedCounselor();

    const res = await book(token, String(doc._id), "10:00");
    expect(res.status).toBe(201);

    const mine = await api().get("/api/student/me").set(auth(token));
    expect(mine.body).toHaveLength(1);
    const theirs = await api().get("/api/bookings/me").set(auth(cToken));
    expect(theirs.body).toHaveLength(1);
  });

  it("rejects overlapping 45-minute sessions but allows back-to-back ones", async () => {
    const { token } = await registerStudent();
    const { doc } = await createApprovedCounselor();
    const id = String(doc._id);

    expect((await book(token, id, "10:00")).status).toBe(201);
    expect((await book(token, id, "10:30")).status).toBe(409); // overlaps
    expect((await book(token, id, "10:45")).status).toBe(201); // starts when the first ends
  });

  it("never double-books under concurrent requests (race condition)", async () => {
    const { token } = await registerStudent();
    const { doc } = await createApprovedCounselor();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => book(token, String(doc._id), "14:00"))
    );
    const created = results.filter((r) => r.status === 201).length;
    expect(created).toBe(1);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
  });

  it("validates input", async () => {
    const { token } = await registerStudent();
    const { doc } = await createApprovedCounselor();
    expect((await book(token, "nope", "10:00")).status).toBe(400);
    expect((await book(token, String(doc._id), "25:99")).status).toBe(400);
    expect((await book(token, String(doc._id), "10:00", "15/01/2030")).status).toBe(400);
  });

  it("labels bookings with a random anonymous alias, never the student id", async () => {
    const { token } = await registerStudent();
    const { doc, token: cToken } = await createApprovedCounselor();
    const res = await book(token, String(doc._id), "10:00");
    expect(res.body.booking.alias).toMatch(/^Anon-[A-Z2-9]{6}$/);
    expect(res.body.booking.alias).not.toBe("S1001");

    const theirs = await api().get("/api/bookings/me").set(auth(cToken));
    expect(theirs.body[0].student).toBeUndefined();
    expect(JSON.stringify(theirs.body)).not.toContain("S1001");
  });

  it("returns server-computed session times (strict 45 minutes)", async () => {
    const { token } = await registerStudent();
    const { doc } = await createApprovedCounselor();
    const res = await book(token, String(doc._id), "10:00");
    const { startAt, endAt } = res.body.booking;
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(45 * 60 * 1000);
  });

  it("rejects slots that are already over and impossible dates", async () => {
    const { token } = await registerStudent();
    const { doc } = await createApprovedCounselor();
    expect((await book(token, String(doc._id), "10:00", "2020-01-15")).status).toBe(400);
    expect((await book(token, String(doc._id), "10:00", "2030-02-31")).status).toBe(400);
  });

  it("only students can book", async () => {
    const { doc, token: cToken } = await createApprovedCounselor();
    expect((await book(cToken, String(doc._id), "10:00")).status).toBe(403);
  });
});

describe("security layers", () => {
  it("sets security headers and hides the framework", async () => {
    const res = await api().get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects oversized JSON bodies", async () => {
    const res = await api().post("/api/student/login").send({ studentId: "a", password: "x".repeat(20000) });
    expect(res.status).toBe(413);
  });

  it("reports readiness only when Mongo and Redis are up", async () => {
    const res = await api().get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mongo: true, redis: true });
  });

  it("rate limits repeated login attempts from one IP (429)", async () => {
    let status = 0;
    for (let i = 0; i < 14; i++) {
      const r = await api().post("/api/student/login").send({ studentId: `nobody${i}`, password: "wrong-password" });
      status = r.status;
    }
    expect(status).toBe(429);
  });
});
