import "dotenv/config";
import { z } from "zod";

const bool = (def) =>
  z
    .enum(["true", "false"])
    .default(def)
    .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5001),
  LOG_LEVEL: z.string().default("info"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  COUNSELOR_SIGNUP_MODE: z.enum(["approval", "open"]).default("approval"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),

  // HTTP / security
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  TRUST_PROXY: z
    .string()
    .default("1")
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : /^\d+$/.test(v) ? Number(v) : v
    ),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).optional(),

  // Booking dates/times ("2030-01-15" + "10:00") are wall-clock times in this IANA zone.
  // Must match where your students are (the browser shows the same wall-clock times).
  SESSION_TZ: z
    .string()
    .default("Asia/Kolkata")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "SESSION_TZ must be a valid IANA time zone, e.g. Asia/Kolkata"),

  // AI summaries / queues
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  SUMMARY_DELAY_MS: z.coerce.number().int().nonnegative().default(180000),
  EMBEDDED_WORKER: bool("false"),
});

// Treat empty values (e.g. "ADMIN_EMAIL=" copied from .env.example) as unset
const source = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== "")
);

const parsed = schema.safeParse(source);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // Fail fast: never boot with a missing/weak configuration.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === "production";

export const env = {
  ...raw,
  isProd,
  isTest: raw.NODE_ENV === "test",
  corsOrigins: raw.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure:
    raw.COOKIE_SECURE !== undefined ? raw.COOKIE_SECURE === "true" : isProd,
  cookieSameSite: raw.COOKIE_SAMESITE ?? (isProd ? "none" : "lax"),
};

if (env.cookieSameSite === "none" && !env.cookieSecure) {
  console.error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
  process.exit(1);
}
