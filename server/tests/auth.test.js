import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, auth, setup, reset, registerStudent, createApprovedCounselor, createAdmin } from "./helpers.js";

beforeAll(setup);
beforeEach(reset);

describe("student auth", () => {
  it("registers, returns a short-lived JWT and an httpOnly refresh cookie", async () => {
    const { res } = await registerStudent();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ role: "student", studentId: "S1001" });
    const cookie = res.headers["set-cookie"].join(";");
    expect(cookie).toMatch(/cw_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("rejects weak passwords and malformed input", async () => {
    const weak = await api().post("/api/student/register").send({ studentId: "S2", name: "x", password: "123" });
    expect(weak.status).toBe(400);
  });

  it("blocks NoSQL operator injection on login", async () => {
    await registerStudent();
    const res = await api()
      .post("/api/student/login")
      .send({ studentId: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).toBe(400);
  });

  it("rejects wrong passwords with a generic message", async () => {
    await registerStudent();
    const res = await api().post("/api/student/login").send({ studentId: "S1001", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid ID or password");
  });

  it("locks an account after repeated failures", async () => {
    await registerStudent();
    let last;
    for (let i = 0; i < 6; i++) {
      last = await api().post("/api/student/login").send({ studentId: "S1001", password: "wrong-password" });
    }
    expect(last.status).toBe(429);
  });
});

describe("JWT + RBAC", () => {
  it("requires a token", async () => {
    expect((await api().get("/api/student/me")).status).toBe(401);
  });

  it("rejects garbage and tampered tokens", async () => {
    const { token } = await registerStudent();
    expect((await api().get("/api/student/me").set(auth("garbage"))).status).toBe(401);
    expect((await api().get("/api/student/me").set(auth(token + "x"))).status).toBe(401);
  });

  it("enforces roles: counselor cannot use student endpoints and vice-versa", async () => {
    const { token: studentToken } = await registerStudent();
    const { token: counselorToken } = await createApprovedCounselor();

    expect((await api().get("/api/student/me").set(auth(studentToken))).status).toBe(200);
    expect((await api().get("/api/student/me").set(auth(counselorToken))).status).toBe(403);
    expect((await api().get("/api/bookings/me").set(auth(counselorToken))).status).toBe(200);
    expect((await api().get("/api/bookings/me").set(auth(studentToken))).status).toBe(403);
    // nobody but an admin reaches admin routes
    expect((await api().get("/api/admin/counselors").set(auth(studentToken))).status).toBe(403);
    expect((await api().get("/api/admin/counselors").set(auth(counselorToken))).status).toBe(403);
  });

  it("rotates refresh tokens: each is single-use", async () => {
    const { cookie } = await registerStudent();

    const first = await api().post("/api/auth/refresh").set("Cookie", cookie);
    expect(first.status).toBe(200);
    expect(first.body.token).toBeTruthy();

    // the old refresh token must now be dead
    const replay = await api().post("/api/auth/refresh").set("Cookie", cookie);
    expect(replay.status).toBe(401);

    // the new one works
    const next = await api().post("/api/auth/refresh").set("Cookie", first.headers["set-cookie"]);
    expect(next.status).toBe(200);
  });

  it("logout revokes the access token and the refresh token", async () => {
    const { token, cookie } = await registerStudent();
    expect((await api().get("/api/student/me").set(auth(token))).status).toBe(200);

    const out = await api().post("/api/auth/logout").set(auth(token)).set("Cookie", cookie);
    expect(out.status).toBe(200);

    expect((await api().get("/api/student/me").set(auth(token))).status).toBe(401);
    expect((await api().post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });
});

describe("counselor approval flow", () => {
  it("new counselors cannot log in until an admin approves them", async () => {
    const signup = await api()
      .post("/api/counselorAuth/signup")
      .send({ name: "New Counselor", email: "new@campus.test", password: "Passw0rd!x" });
    expect(signup.status).toBe(202);
    expect(signup.body.token).toBeUndefined();

    const early = await api().post("/api/counselorAuth/login").send({ email: "new@campus.test", password: "Passw0rd!x" });
    expect(early.status).toBe(403);

    // not listed for students while pending
    expect((await api().get("/api/counselorAuth/list")).body).toHaveLength(0);

    const { token: adminToken } = await createAdmin();
    const pending = await api().get("/api/admin/counselors?status=pending").set(auth(adminToken));
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].password).toBeUndefined();

    const approve = await api()
      .patch(`/api/admin/counselors/${pending.body[0]._id}`)
      .set(auth(adminToken))
      .send({ status: "approved" });
    expect(approve.status).toBe(200);

    const ok = await api().post("/api/counselorAuth/login").send({ email: "new@campus.test", password: "Passw0rd!x" });
    expect(ok.status).toBe(200);
    expect((await api().get("/api/counselorAuth/list")).body).toHaveLength(1);
  });
});
