import express from "express";
import Counselor from "../models/Counselor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body; // now also include email
  try {
    const existing = await Counselor.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCounselor = new Counselor({ name, email, password: hashedPassword });
    await newCounselor.save();

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const counselor = await Counselor.findOne({ email });
    if (!counselor) return res.status(401).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, counselor.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: counselor._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, name: counselor.name, email: counselor.email });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router; // ✅ ES Module export
