import express from "express";

import {
  counselorSignup,
  counselorLogin,
  getCounselors,
} from "../controllers/counselorAuthController.js";

const router = express.Router();

router.post(
  "/signup",
  counselorSignup
);

router.post(
  "/login",
  counselorLogin
);

// Used by students when selecting a counselor
router.get(
  "/list",
  getCounselors
);

export default router;