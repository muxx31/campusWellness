import express from "express";
import Booking from "../models/Booking.js";
import Counselor from "../models/Counselor.js";

import {
  protect,
  requireStudent,
  requireCounselor,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =====================================================
// STUDENT: CREATE BOOKING
// POST /api/book
// =====================================================

router.post(
  "/book",
  protect,
  requireStudent,
  async (req, res) => {
    try {
      const {
        counselorId,
        date,
        time,
        issue,
      } = req.body;

      if (
        !counselorId ||
        !date ||
        !time
      ) {
        return res.status(400).json({
          error:
            "Counselor, date, and time are required",
        });
      }

      // -------------------------------------------------
      // FIND THE EXACT COUNSELOR
      // -------------------------------------------------

      const counselor =
        await Counselor.findById(
          counselorId
        );

      if (!counselor) {
        return res.status(404).json({
          error: "Counselor not found",
        });
      }

      // -------------------------------------------------
      // NEW SESSION TIME
      // Every counseling session = 45 minutes
      // -------------------------------------------------

      const newStart = new Date(
        `${date}T${time}`
      );

      if (
        Number.isNaN(
          newStart.getTime()
        )
      ) {
        return res.status(400).json({
          error: "Invalid date or time",
        });
      }

      const SESSION_DURATION =
        45 * 60 * 1000;

      const newEnd = new Date(
        newStart.getTime() +
          SESSION_DURATION
      );

      // -------------------------------------------------
      // FIND ALL BOOKINGS FOR THIS COUNSELOR ON THIS DATE
      // -------------------------------------------------

      const existingBookings =
        await Booking.find({
          counselor:
            counselor._id,
          date,
        });

      // -------------------------------------------------
      // CHECK FOR OVERLAPPING SESSION
      // -------------------------------------------------

      const hasConflict =
        existingBookings.some(
          (booking) => {
            const existingStart =
              new Date(
                `${booking.date}T${booking.time}`
              );

            const existingEnd =
              new Date(
                existingStart.getTime() +
                  SESSION_DURATION
              );

            // Two intervals overlap when:
            //
            // newStart < existingEnd
            // AND
            // newEnd > existingStart

            return (
              newStart <
                existingEnd &&
              newEnd >
                existingStart
            );
          }
        );

      if (hasConflict) {
        return res.status(409).json({
          error:
            "This counselor already has a session during the selected time. Please choose another time.",
        });
      }

      // -------------------------------------------------
      // CREATE BOOKING
      // -------------------------------------------------

      const newBooking =
        new Booking({
          // Student identity comes ONLY from JWT
          student:
            req.user._id,

          alias:
            req.user.studentId,

          // Exact counselor MongoDB ID
          counselor:
            counselor._id,

          // Display name only
          counselorName:
            counselor.name,

          date,
          time,
          issue,
        });

      await newBooking.save();

      return res.status(201).json({
        message:
          "Booking successful",

        booking:
          newBooking,
      });
    } catch (err) {
      console.error(
        "Booking error:",
        err.message
      );

      return res.status(500).json({
        error:
          "Something went wrong",
      });
    }
  }
);


// =====================================================
// COUNSELOR: GET OWN BOOKINGS
// GET /api/bookings/me
// =====================================================

router.get(
  "/bookings/me",
  protect,
  requireCounselor,
  async (req, res) => {
    try {
      const bookings =
        await Booking.find({
          counselor:
            req.user._id,
        }).sort({
          date: 1,
          time: 1,
        });

      res.status(200).json(
        bookings
      );
    } catch (err) {
      console.error(
        "Error fetching counselor bookings:",
        err.message
      );

      res.status(500).json({
        error: "Server error",
      });
    }
  }
);


// =====================================================
// STUDENT: GET OWN BOOKINGS
// GET /api/student/me
// =====================================================

router.get(
  "/student/me",
  protect,
  requireStudent,
  async (req, res) => {
    try {
      const bookings =
        await Booking.find({
          student:
            req.user._id,
        }).sort({
          date: 1,
          time: 1,
        });

      res.status(200).json(
        bookings
      );
    } catch (err) {
      console.error(
        "Error fetching student bookings:",
        err.message
      );

      res.status(500).json({
        error: "Server error",
      });
    }
  }
);

export default router;