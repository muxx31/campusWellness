import express from "express";
import {
  createBooking,
  myCounselorBookings,
  myStudentBookings,
} from "../controllers/bookingController.js";
import { protect, requireStudent, requireCounselor } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { bookingLimiter } from "../middleware/rateLimiters.js";
import { bookingSchema } from "../validators/schemas.js";

const router = express.Router();

// STUDENT: POST /api/book
router.post("/book", protect, requireStudent, bookingLimiter, validate(bookingSchema), createBooking);
// COUNSELOR: GET /api/bookings/me
router.get("/bookings/me", protect, requireCounselor, myCounselorBookings);
// STUDENT: GET /api/student/me
router.get("/student/me", protect, requireStudent, myStudentBookings);

export default router;
