const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// POST /api/book - Create a new booking
router.post('/book', async (req, res) => {
  try {
    const { alias, counselor, date, time, issue } = req.body;

    if (!alias || !counselor || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newBooking = new Booking({ alias, counselor, date, time, issue });
    await newBooking.save();

    res.status(201).json({ message: 'Booking successful', booking: newBooking });
  } catch (err) {
    console.error('Booking error:', err.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET /api/bookings/:counselor - Get all bookings for a counselor
router.get('/bookings/:counselor', async (req, res) => {
  try {
    const counselor = req.params.counselor;
    const bookings = await Booking.find({ counselor });
    res.status(200).json(bookings);
  } catch (err) {
    console.error('Error fetching bookings for counselor:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/student/:alias - Get all bookings for a student alias
router.get('/student/:alias', async (req, res) => {
  try {
    const alias = req.params.alias;
    const bookings = await Booking.find({ alias });
    res.status(200).json(bookings);
  } catch (err) {
    console.error('Error fetching student bookings:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
