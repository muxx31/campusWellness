import Counselor from "../models/Counselor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Create JWT
const generateToken = (id) => {
  return jwt.sign(
    {
      id,
      role: "counselor",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
};

// Counselor Signup
export const counselorSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email, and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingCounselor =
      await Counselor.findOne({
        email: normalizedEmail,
      });

    if (existingCounselor) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const counselor =
      await Counselor.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
      });

    const token = generateToken(
      counselor._id
    );

    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: counselor._id,
        role: "counselor",
        name: counselor.name,
        email: counselor.email,
      },
    });
  } catch (err) {
    console.error(
      "Counselor signup error:",
      err
    );

    if (err.code === 11000) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    res.status(500).json({
      message:
        "Server error during signup",
    });
  }
};

// Counselor Login
export const counselorLogin = async (
  req,
  res
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const counselor =
      await Counselor.findOne({
        email: normalizedEmail,
      });

    if (!counselor) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        counselor.password
      );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const token = generateToken(
      counselor._id
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: counselor._id,
        role: "counselor",
        name: counselor.name,
        email: counselor.email,
      },
    });
  } catch (err) {
    console.error(
      "Counselor login error:",
      err
    );

    res.status(500).json({
      message:
        "Server error during login",
    });
  }
};

// Get counselors for student booking
export const getCounselors = async (
  req,
  res
) => {
  try {
    const counselors =
      await Counselor.find({})
        .select("_id name")
        .sort({ name: 1 });

    res.status(200).json(counselors);
  } catch (err) {
    console.error(
      "Error fetching counselors:",
      err
    );

    res.status(500).json({
      message:
        "Could not fetch counselors",
    });
  }
};