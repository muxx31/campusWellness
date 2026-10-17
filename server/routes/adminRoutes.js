import express from "express";
import {
  adminLogin,
  listCounselors,
  setCounselorStatus,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import {
  emailLoginSchema,
  idParamSchema,
  counselorStatusSchema,
} from "../validators/schemas.js";

const router = express.Router();
router.post("/login", loginLimiter, validate(emailLoginSchema), adminLogin);

router.use(protect, requireAdmin);
router.get("/counselors", listCounselors);
router.patch(
  "/counselors/:id",
  validate(idParamSchema, "params"),
  validate(counselorStatusSchema),
  setCounselorStatus
);
export default router;
