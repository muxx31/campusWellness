import { signAccessToken, createRefreshToken, consumeRefreshToken } from "./tokenService.js";
import { setRefreshCookie } from "../utils/cookies.js";
import { publicUser, loadUser } from "./userService.js";

// Issues an access token (JSON body) + rotating refresh token (httpOnly cookie).
export const startSession = async (res, role, userDoc) => {
  const id = String(userDoc._id);
  const token = signAccessToken({ id, role });
  const refresh = await createRefreshToken({ id, role });
  setRefreshCookie(res, refresh);
  return { token, user: publicUser(role, userDoc) };
};

export const refreshSession = async (res, rawRefresh) => {
  const owner = await consumeRefreshToken(rawRefresh);
  if (!owner) return null;
  // Re-validate the account (deleted / un-approved users cannot refresh)
  const user = await loadUser(owner.role, owner.id);
  return startSession(res, owner.role, user);
};
