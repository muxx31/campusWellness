import { env } from "../config/env.js";

export const REFRESH_COOKIE = "cw_rt";
const REFRESH_PATH = "/api/auth";

const base = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: REFRESH_PATH,
});

export const setRefreshCookie = (res, value) =>
  res.cookie(REFRESH_COOKIE, value, {
    ...base(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, base());
