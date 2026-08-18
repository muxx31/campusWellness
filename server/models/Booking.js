import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  // Actual student account
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },

  // Student ID used/displayed anonymously
  alias: {
    type: String,
    required: true,
  },

  // Actual counselor account
  counselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Counselor",
    required: true,
  },

  // Counselor name kept for display/chat
  counselorName: {
    type: String,
    required: true,
  },

  date: {
    type: String,
    required: true,
  },

  time: {
    type: String,
    required: true,
  },

  issue: {
    type: String,
    required: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model(
  "Booking",
  bookingSchema
);