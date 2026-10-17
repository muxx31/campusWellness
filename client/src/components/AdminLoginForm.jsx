import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../config";

// Same card style as the student/counselor login forms, in the admin accent colour (teal).
const AdminLoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/login`, {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      onLogin(res.data.user);
    } catch (err) {
      setMessage(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[url(/images/Cover.jpeg)] bg-cover bg-center min-h-screen w-full flex flex-col items-center justify-center gap-6 p-4 sm:p-6 md:p-8">
      <h2 className="bg-white rounded-3xl text-3xl sm:text-5xl md:text-6xl font-semibold text-black text-center px-4 py-2 sm:px-6 sm:py-3">
        Campus Wellness
      </h2>

      <div className="bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-1 text-white">
          Admin Login
        </h2>
        <p className="text-center text-teal-200 text-sm mb-6">
          Restricted area · authorised staff only
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="border p-2 rounded bg-white text-black"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="border p-2 rounded bg-white text-black"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 text-white p-2 rounded hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {message && (
          <p className="mt-3 text-center text-red-400">{message}</p>
        )}
      </div>
    </div>
  );
};

export default AdminLoginForm;
