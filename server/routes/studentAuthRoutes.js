import express from "express";
import { registerStudent, loginStudent } from "../controllers/studentAuthController.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimiters.js";
import { studentRegisterSchema, studentLoginSchema } from "../validators/schemas.js";

const router = express.Router();
router.post("/register", signupLimiter, validate(studentRegisterSchema), registerStudent);
router.post("/login", loginLimiter, validate(studentLoginSchema), loginStudent);
export default router;
