import { refreshSession } from "../services/sessionService.js";
import {
  blacklistAccessToken,
  revokeRefreshToken,
  verifyAccessToken,
} from "../services/tokenService.js";
import { clearRefreshCookie, REFRESH_COOKIE } from "../utils/cookies.js";
import { extractBearer } from "../middleware/authMiddleware.js";
import { disconnectUserSockets } from "../socket/emitter.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

// POST /api/auth/refresh  -> new access token + rotated refresh cookie
export const refresh = asyncHandler(async (req, res) => {
  let session = null;
  try {
    session = await refreshSession(res, req.cookies?.[REFRESH_COOKIE]);
  } catch {
    session = null; // account removed / un-approved
  }
  if (!session) {
    clearRefreshCookie(res);
    throw new AppError(401, "Session expired. Please log in again.");
  }
  res.status(200).json(session);
});

// POST /api/auth/logout -> revoke both tokens and drop live sockets
export const logout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);

  const token = extractBearer(req);
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      await blacklistAccessToken(payload);
      await disconnectUserSockets(payload.id);
    } catch {
      /* already invalid/expired: nothing to revoke */
    }
  }

  clearRefreshCookie(res);
  res.status(200).json({ message: "Logged out" });
});
