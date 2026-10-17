import mongoose from "mongoose";

// Chat transcript, written asynchronously by the BullMQ persist worker.
// RETENTION = CHAT DURATION: each message carries `expireAt` (the end of its 45-minute
// session) and MongoDB's TTL monitor deletes it then (it runs about once a minute).
const messageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  room: { type: String, required: true },
  alias: { type: String, required: true },
  role: { type: String, enum: ["student", "counselor"], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
  expireAt: { type: Date, required: true },
});

messageSchema.index({ booking: 1, createdAt: 1 });
messageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
