import Counselor from "../models/Counselor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ✅ Counselor Signup Controller
export const counselorSignup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // check if already exists
    const existing = await Counselor.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // save new counselor
    const newCounselor = new Counselor({ name, email, password: hashedPassword });
    await newCounselor.save();

    res.status(201).json({ message: "Signup successful! Please log in." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
};

// ✅ Counselor Login Controller
export const counselorLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const counselor = await Counselor.findOne({ email });
    if (!counselor) return res.status(401).json({ error: "Counselor not found" });

    const isMatch = await bcrypt.compare(password, counselor.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid password" });

    // create jwt token
    const token = jwt.sign(
      { id: counselor._id, role: "counselor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      name: counselor.name,
      email: counselor.email,
      message: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
};
