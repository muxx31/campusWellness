import express from "express";
import {
  counselorSignup,
  counselorLogin,
  getCounselors,
} from "../controllers/counselorAuthController.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimiters.js";
import { counselorSignupSchema, emailLoginSchema } from "../validators/schemas.js";

const router = express.Router();
router.post("/signup", signupLimiter, validate(counselorSignupSchema), counselorSignup);
router.post("/login", loginLimiter, validate(emailLoginSchema), counselorLogin);
// Used by students when selecting a counselor
router.get("/list", getCounselors);
export default router;
