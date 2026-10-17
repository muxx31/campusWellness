import Student from "../models/Student.js";
import { generateAlias } from "../utils/alias.js";
import { invalidateUser } from "./userService.js";

// Returns the student's anonymous alias, creating one for legacy accounts that predate it.
// Accepts the (cached, lean) user object.
export const ensureAlias = async (student) => {
  if (student.alias) return student.alias;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateAlias();
    try {
      // Only set it if still missing: two concurrent requests converge on one alias.
      await Student.updateOne(
        { _id: student._id, alias: { $exists: false } },
        { $set: { alias: candidate } }
      );
      const fresh = await Student.findById(student._id).select("alias").lean();
      await invalidateUser("student", student._id);
      if (fresh?.alias) return fresh.alias;
    } catch (err) {
      if (err.code !== 11000) throw err; // alias collision: try another
    }
  }
  throw new Error("Could not allocate an anonymous alias");
};
