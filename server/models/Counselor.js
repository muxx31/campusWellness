import mongoose from "mongoose";

const counselorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // ensures no duplicate email
  },
  password: {
    type: String,
    required: true,
  },
});

const Counselor = mongoose.model("Counselor", counselorSchema);
export default Counselor;
