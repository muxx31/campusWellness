import express from "express";
import { refresh, logout } from "../controllers/authController.js";
import { refreshLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);
export default router;
