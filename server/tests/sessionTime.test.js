import { describe, expect, it } from "vitest";
import {
  SESSION_DURATION_MS,
  sessionEnd,
  sessionStart,
  sessionState,
  zonedToInstant,
} from "../utils/sessionTime.js";

describe("session time (strict 45 minutes, SESSION_TZ-aware)", () => {
  it("interprets booking times as wall-clock time in the configured zone", () => {
    // India has no DST: UTC+05:30
    expect(zonedToInstant("2030-01-15", "10:00", "Asia/Kolkata").toISOString()).toBe(
      "2030-01-15T04:30:00.000Z"
    );
    // New York: UTC-5 in winter, UTC-4 in summer (DST handled)
    expect(zonedToInstant("2030-01-15", "10:00", "America/New_York").toISOString()).toBe(
      "2030-01-15T15:00:00.000Z"
    );
    expect(zonedToInstant("2030-07-15", "10:00", "America/New_York").toISOString()).toBe(
      "2030-07-15T14:00:00.000Z"
    );
  });

  it("rejects impossible calendar dates", () => {
    expect(zonedToInstant("2030-02-31", "10:00", "Asia/Kolkata")).toBeNull();
    expect(zonedToInstant("2030-13-01", "10:00", "Asia/Kolkata")).toBeNull();
  });

  it("is exactly 45 minutes long", () => {
    expect(SESSION_DURATION_MS).toBe(45 * 60 * 1000);
    const start = sessionStart("2030-01-15", "10:00", "Asia/Kolkata");
    const end = sessionEnd("2030-01-15", "10:00", "Asia/Kolkata");
    expect(end - start).toBe(45 * 60 * 1000);
  });

  it("classifies upcoming / active / ended with start inclusive and end exclusive", () => {
    const tz = "Asia/Kolkata";
    const start = sessionStart("2030-01-15", "10:00", tz).getTime();
    const state = (t) => sessionState("2030-01-15", "10:00", t, tz);
    expect(state(start - 1)).toBe("upcoming");
    expect(state(start)).toBe("active");
    expect(state(start + 44 * 60000 + 59000)).toBe("active");
    expect(state(start + 45 * 60000)).toBe("ended");
  });
});
