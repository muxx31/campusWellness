import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// Hash password before saving
studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// Compare password during login
studentSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(
    enteredPassword,
    this.password
  );
};

const Student = mongoose.model("Student", studentSchema);

export default Student;