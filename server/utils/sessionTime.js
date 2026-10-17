import { env } from "../config/env.js";

// Single source of truth for session timing. Every session is exactly 45 minutes.
// (Planned feature: an "extend by 10 minutes" button. When it lands, this is the only
//  place that needs to learn about extensions.)
export const SESSION_MINUTES = 45;
export const SESSION_DURATION_MS = SESSION_MINUTES * 60 * 1000;

// Offset (ms) of `tz` from UTC at the instant `utcMs`.
const tzOffsetMs = (utcMs, tz) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
};

// "2030-01-15" + "10:00" interpreted as wall-clock time in `tz` -> the real instant.
// Returns null for impossible dates such as 2030-02-31.
export const zonedToInstant = (date, time, tz = env.SESSION_TZ) => {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);

  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }

  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz); // second pass settles daylight-saving edges
  return new Date(utc);
};

export const sessionStart = (date, time, tz) => zonedToInstant(date, time, tz);

export const sessionEnd = (date, time, tz) => {
  const start = sessionStart(date, time, tz);
  return start && new Date(start.getTime() + SESSION_DURATION_MS);
};

// "upcoming" | "active" | "ended"  (start inclusive, end exclusive)
export const sessionState = (date, time, now = Date.now(), tz) => {
  const start = sessionStart(date, time, tz);
  if (!start) return "ended";
  const t = typeof now === "number" ? now : now.getTime();
  if (t < start.getTime()) return "upcoming";
  if (t >= start.getTime() + SESSION_DURATION_MS) return "ended";
  return "active";
};

// Fields the client uses so that it never has to guess time zones.
export const withTiming = (booking) => {
  const start = sessionStart(booking.date, booking.time);
  return {
    ...booking,
    startAt: start ? start.toISOString() : null,
    endAt: start ? new Date(start.getTime() + SESSION_DURATION_MS).toISOString() : null,
  };
};
