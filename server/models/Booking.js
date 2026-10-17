import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  // Student ID shown to the counselor
  alias: { type: String, required: true },
  counselor: { type: mongoose.Schema.Types.ObjectId, ref: "Counselor", required: true },
  counselorName: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:mm
  issue: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

// Hard guarantee against exact double-booking, even if the Redis lock is bypassed.
bookingSchema.index({ counselor: 1, date: 1, time: 1 }, { unique: true });
bookingSchema.index({ student: 1, date: 1, time: 1 });

export default mongoose.model("Booking", bookingSchema);
