import express from "express";
import { counselorSignup, counselorLogin } from "../controllers/counselorAuthController.js";

const router = express.Router();

// routes
router.post("/signup", counselorSignup);
router.post("/login", counselorLogin);

export default router;
