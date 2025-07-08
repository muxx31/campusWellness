import React, { useState } from 'react';
import axios from 'axios';

const BookingForm = ({ alias, onBookingSuccess }) => {
  const [form, setForm] = useState({
    alias: alias || '',
    counselor: '',
    date: '',
    time: '',
    issue: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5001/api/book', form);
      if (onBookingSuccess) onBookingSuccess(); // 👈 notify Home to re-fetch

      // Reset form
      setForm({
        alias: alias || '',
        counselor: '',
        date: '',
        time: '',
        issue: '',
      });
    } catch (err) {
      console.error('Error:', err.response?.data || err.message);
      alert('❌ Booking failed');
    }
  };

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-500 p-6 rounded-xl shadow-md max-w-xl mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-center">Book Anonymous Counseling</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        {!alias && (
          <input
            name="alias"
            placeholder="Alias"
            value={form.alias}
            onChange={handleChange}
            required
            className="w-full border px-3 py-2 rounded"
          />
        )}
        <input
          name="counselor"
          placeholder="Counselor Name"
          value={form.counselor}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="time"
          name="time"
          value={form.time}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <textarea
          name="issue"
          placeholder="Optional: Describe your issue"
          value={form.issue}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700"
        >
          Book Session
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
