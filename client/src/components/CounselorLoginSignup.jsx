import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../config";

const CounselorLoginSignup = ({
  onLogin,
}) => {
  const [isSignup, setIsSignup] =
    useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });

    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      // SIGNUP
      if (isSignup) {
        const res = await axios.post(
          `${BACKEND_URL}/api/counselorAuth/signup`,
          {
            name: form.name,
            email: form.email,
            password: form.password,
          }
        );

        // Accounts must be approved by an administrator before first login
        if (res.data.pendingApproval || !res.data.token) {
          setMessage(res.data.message);
          setIsSignup(false);
          return;
        }

        // Store JWT
        localStorage.setItem(
          "token",
          res.data.token
        );

        // Store common user object
        localStorage.setItem(
          "user",
          JSON.stringify(res.data.user)
        );

        // Go directly to dashboard
        onLogin(res.data.user);

        return;
      }

      // LOGIN
      const {
        email,
        password,
      } = form;

      if (!email || !password) {
        setError(
          "Email and password are required"
        );
        return;
      }

      const res = await axios.post(
        `${BACKEND_URL}/api/counselorAuth/login`,
        {
          email,
          password,
        }
      );

      // Store JWT
      localStorage.setItem(
        "token",
        res.data.token
      );

      // Store common user object
      localStorage.setItem(
        "user",
        JSON.stringify(res.data.user)
      );

      // Go directly to dashboard
      onLogin(res.data.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong"
      );
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">

        <h2 className="text-2xl font-bold text-center mb-6 text-white">
          {isSignup
            ? "Counselor Signup"
            : "Counselor Login"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {isSignup && (
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded"
            />
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
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
            {isSignup
              ? "Sign Up"
              : "Log In"}
          </button>
        </form>

        <p className="text-sm mt-4 text-center text-white">
          {isSignup
            ? "Already have an account?"
            : "Don't have an account?"}{" "}

          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);

              setForm({
                name: "",
                email: "",
                password: "",
              });

              setError("");
              setMessage("");
            }}
            className="text-blue-400 underline"
          >
            {isSignup
              ? "Log In"
              : "Sign Up"}
          </button>
        </p>

        {error && (
          <p className="text-red-500 text-sm mt-3 text-center">
            {error}
          </p>
        )}

        {message && (
          <p className="text-green-400 text-sm mt-3 text-center">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CounselorLoginSignup;