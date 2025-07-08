import React, { useState } from 'react';
import axios from 'axios';
import BACKEND_URL from '../config'; // ✅ Import backend URL

const CounselorLoginSignup = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (isSignup) {
        const res = await axios.post(`${BACKEND_URL}/api/auth/signup`, form); // ✅ updated URL
        setMessage(res.data.message || 'Signup successful! You can now log in.');
        setIsSignup(false);
        setForm({ name: '', password: '' });
      } else {
        const res = await axios.post(`${BACKEND_URL}/api/auth/login`, form); // ✅ updated URL
        const userData = { role: 'counselor', name: res.data.name };

        // ✅ Save to localStorage
        localStorage.setItem('user', JSON.stringify(userData));

        // ✅ Call parent login handler
        onLogin(userData);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  };

  return (
    <div className="flex items-center justify-center ">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-white">
          {isSignup ? 'Counselor Signup' : 'Counselor Login'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded"
          />
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <p className="text-sm mt-4 text-center text-white">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setForm({ name: '', password: '' });
              setError('');
              setMessage('');
            }}
            className="text-blue-400 underline"
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>

        {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
        {message && <p className="text-green-500 text-sm mt-3 text-center">{message}</p>}
      </div>
    </div>
  );
};

export default CounselorLoginSignup;
