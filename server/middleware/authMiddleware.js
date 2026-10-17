import { verifyAccessToken } from "../services/tokenService.js";
import { loadUser } from "../services/userService.js";
import { AppError, asyncHandler } from "../utils/AppError.js";

export const extractBearer = (req) => {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7) : null;
};

// Authentication: verifies the JWT, checks revocation, loads the (cached) user.
export const protect = asyncHandler(async (req, res, next) => {
  const token = extractBearer(req);
  if (!token) throw new AppError(401, "Not authorized. No token provided.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AppError(401, "Not authorized. Invalid or expired token.");
  }

  req.user = await loadUser(payload.role, payload.id);
  req.userRole = payload.role;
  req.auth = payload;
  next();
});

// Role-based access control: authorize("admin"), authorize("student", "counselor")...
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return next(
        new AppError(403, `Access denied. ${roles.join(" or ")} access required.`)
      );
    }
    next();
  };

export const requireStudent = authorize("student");
export const requireCounselor = authorize("counselor");
export const requireAdmin = authorize("admin");
