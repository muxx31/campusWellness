import React, { useState } from "react";
import axios from "axios";
import BACKEND_URL from "../config"; // make sure this is a named export

const StudentLoginSignup = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState(""); // only for signup
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        // LOGIN
        if (!studentId || !password) {
          setMessage("Student ID and password are required");
          return;
        }

        const res = await axios.post(`${BACKEND_URL}/api/student/login`, {
          studentId,
          password,
        });

        // Save token
        localStorage.setItem("studentToken", res.data.token);

        // ✅ Update user state in App.jsx
        onLogin({ role: "student", name: res.data.studentId });

        setMessage(`Welcome ${res.data.studentId}!`);
      } else {
        // SIGNUP
        if (!studentId || !name || !password) {
          setMessage("All fields are required for signup");
          return;
        }

        const res = await axios.post(`${BACKEND_URL}/api/student/register`, {
          studentId,
          name,
          password,
        });

        // Save token
        localStorage.setItem("studentToken", res.data.token);

        // ✅ Update user state in App.jsx
        onLogin({ role: "student", name: name });

        setMessage(`Signup successful! Welcome ${name}`);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Error occurred");
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-white">
          {isLogin ? "Student Login" : "Student Signup"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border p-2 rounded"
            />
          )}
          <input
            type="text"
            placeholder="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            {isLogin ? "Login" : "Signup"}
          </button>
        </form>
        <p className="mt-4 text-center">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <span className="text-blue-600 cursor-pointer" onClick={toggleForm}>
            {isLogin ? "Signup" : "Login"}
          </span>
        </p>
        {message && <p className="mt-2 text-center text-green-600">{message}</p>}
      </div>
    </div>
  );
};

export default StudentLoginSignup;
