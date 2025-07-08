const express = require('express');
const router = express.Router();
const Counselor = require('../models/Counselor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// SIGNUP
router.post('/signup', async (req, res) => {
  const { name, password } = req.body;
  try {
    const existing = await Counselor.findOne({ name });
    if (existing) return res.status(400).json({ error: 'Name already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCounselor = new Counselor({ name, password: hashedPassword });
    await newCounselor.save();

    res.status(201).json({ message: 'Signup successful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const counselor = await Counselor.findOne({ name });
    if (!counselor) return res.status(401).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, counselor.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: counselor._id }, 'your_jwt_secret', { expiresIn: '1h' });

    res.json({ token, name: counselor.name });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
