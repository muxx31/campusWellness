import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  alias: {
    type: String,
    required: true,
  },
  counselor: {
    type: String, // we'll use counselor name for now (can change to ObjectId later)
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

export default mongoose.model('Booking', bookingSchema);
