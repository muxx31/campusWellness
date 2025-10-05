import Student from "../models/Student.js";
import jwt from "jsonwebtoken";

// helper to create token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @desc Register student
export const registerStudent = async (req, res) => {
    try {
      const { studentId, name, password } = req.body;
  
      // ✅ Check all required fields
      if (!studentId || !name || !password) {
        return res.status(400).json({ message: "Student ID, name, and password are required" });
      }
  
      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        return res.status(400).json({ message: "Student ID already exists" });
      }
  
      const student = await Student.create({ studentId, name, password });
      const token = generateToken(student._id);
  
      res.status(201).json({
        _id: student._id,
        studentId: student.studentId,
        name: student.name, // ✅ include name in response
        token,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  

// @desc Login student
export const loginStudent = async (req, res) => {
  try {
    const { studentId, password } = req.body;
    const student = await Student.findOne({ studentId });

    if (student && (await student.matchPassword(password))) {
      const token = generateToken(student._id);
      res.json({
        _id: student._id,
        studentId: student.studentId,
        token,
      });
    } else {
      res.status(401).json({ message: "Invalid ID or password" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
