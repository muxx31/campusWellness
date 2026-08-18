import jwt from "jsonwebtoken";
import Student from "../models/Student.js";
import Counselor from "../models/Counselor.js";

// Authentication middleware
export const protect = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization;

    // Check token
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message:
          "Not authorized. No token provided.",
      });
    }

    // Extract token
    const token =
      authHeader.split(" ")[1];

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Student
    if (decoded.role === "student") {
      const student =
        await Student.findById(
          decoded.id
        ).select("-password");

      if (!student) {
        return res.status(401).json({
          message: "Student not found",
        });
      }

      req.user = student;
      req.userRole = "student";

      return next();
    }

    // Counselor
    if (decoded.role === "counselor") {
      const counselor =
        await Counselor.findById(
          decoded.id
        ).select("-password");

      if (!counselor) {
        return res.status(401).json({
          message: "Counselor not found",
        });
      }

      req.user = counselor;
      req.userRole = "counselor";

      return next();
    }

    return res.status(401).json({
      message: "Invalid user role",
    });
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(401).json({
      message:
        "Not authorized. Invalid or expired token.",
    });
  }
};

// Authorization: student only
export const requireStudent = (
  req,
  res,
  next
) => {
  if (req.userRole !== "student") {
    return res.status(403).json({
      message:
        "Access denied. Student access required.",
    });
  }

  next();
};

// Authorization: counselor only
export const requireCounselor = (
  req,
  res,
  next
) => {
  if (req.userRole !== "counselor") {
    return res.status(403).json({
      message:
        "Access denied. Counselor access required.",
    });
  }

  next();
};