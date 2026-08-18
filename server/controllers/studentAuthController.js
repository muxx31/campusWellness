import Student from "../models/Student.js";
import jwt from "jsonwebtoken";

// Create JWT
const generateToken = (id) => {
  return jwt.sign(
    {
      id,
      role: "student",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// Student Signup
export const registerStudent = async (req, res) => {
  try {
    const { studentId, name, password } = req.body;

    // Validate fields
    if (!studentId || !name || !password) {
      return res.status(400).json({
        message:
          "Student ID, name, and password are required",
      });
    }

    // Student ID is intentionally NOT lowercased.
    // Therefore it remains case-sensitive.
    const existingStudent = await Student.findOne({
      studentId,
    });

    if (existingStudent) {
      return res.status(400).json({
        message: "Student ID already exists",
      });
    }

    // Student model hashes the password automatically
    const student = await Student.create({
      studentId,
      name,
      password,
    });

    const token = generateToken(student._id);

    // Same user structure used by login
    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: student._id,
        role: "student",
        name: student.name,
        studentId: student.studentId,
      },
    });
  } catch (err) {
    console.error("Student signup error:", err);

    // Handle duplicate studentId race condition
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Student ID already exists",
      });
    }

    res.status(500).json({
      message: "Server error during signup",
    });
  }
};

// Student Login
export const loginStudent = async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({
        message:
          "Student ID and password are required",
      });
    }

    // Exact studentId lookup
    const student = await Student.findOne({
      studentId,
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid ID or password",
      });
    }

    const isPasswordCorrect =
      await student.matchPassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid ID or password",
      });
    }

    const token = generateToken(student._id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: student._id,
        role: "student",
        name: student.name,
        studentId: student.studentId,
      },
    });
  } catch (err) {
    console.error("Student login error:", err);

    res.status(500).json({
      message: "Server error during login",
    });
  }
};