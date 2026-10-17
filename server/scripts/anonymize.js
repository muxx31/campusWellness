// One-off migration for databases created BEFORE anonymity + retention were added.
//   npm run migrate:anonymize
// Safe to run more than once.
//
//  1. gives every student without one a random anonymous alias
//  2. rewrites Booking.alias (which used to be the real studentId) to that alias
//  3. deletes legacy chat messages that have no expiry (they would otherwise live forever)
import { connectDB, disconnectDB } from "../config/db.js";
import Student from "../models/Student.js";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import { generateAlias } from "../utils/alias.js";

await connectDB();

// 1. aliases
const missing = await Student.find({ alias: { $exists: false } }).select("_id").lean();
let assigned = 0;
for (const { _id } of missing) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await Student.updateOne(
        { _id, alias: { $exists: false } },
        { $set: { alias: generateAlias() } }
      );
      if (r.modifiedCount) assigned++;
      break;
    } catch (err) {
      if (err.code !== 11000) throw err; // alias collision: draw another
    }
  }
}
console.log(`Aliases assigned: ${assigned}`);

// 2. bookings
const students = await Student.find({ alias: { $exists: true } }).select("alias").lean();
let bookingsFixed = 0;
for (let i = 0; i < students.length; i += 500) {
  const ops = students.slice(i, i + 500).map((s) => ({
    updateMany: {
      filter: { student: s._id, alias: { $ne: s.alias } },
      update: { $set: { alias: s.alias } },
    },
  }));
  const r = await Booking.bulkWrite(ops);
  bookingsFixed += r.modifiedCount;
}
console.log(`Bookings re-labelled with anonymous aliases: ${bookingsFixed}`);

// 3. legacy messages
const del = await Message.deleteMany({ expireAt: { $exists: false } });
console.log(`Legacy chat messages deleted (no expiry): ${del.deletedCount}`);

await Message.syncIndexes(); // make sure the TTL index exists
await disconnectDB();
process.exit(0);
