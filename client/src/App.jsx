import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import StudentLoginSignup from "./components/StudentLoginSignup";
import CounselorLoginSignup from "./components/CounselorLoginSignup";
import Home from "./components/Home";
import CounselorDashboard from "./components/CounselorDashboard";
import ChatRoom from "./components/ChatRoom";

function App() {
  const [user, setUser] = useState(null);
  const [roleSelect, setRoleSelect] = useState("");

  // ✅ On app load, try restoring user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ✅ On login, save user to localStorage too
  const handleLogin = ({ role, name }) => {
    const userData = { role, name };
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setRoleSelect("");
    localStorage.removeItem("user");
    localStorage.removeItem("chatSession");
  };

  return (
    <Router>
      <div className="min-h-screen min-w-screen">
        <Routes>
          <Route
            path="/"
            element={
              !user ? (
                <div className="bg-[url(/images/Cover.jpeg)] bg-cover bg-center min-h-screen flex flex-col items-center justify-center gap-6 p-4 sm:p-6 md:p-8">
                  <h2 className="bg-white rounded-3xl sm:rounded-4xl text-4xl sm:text-6xl md:text-8xl font-semibold text-black text-center px-4 py-2 sm:px-6 sm:py-3">
                    Campus Wellness
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto"
                      onClick={() => setRoleSelect("student")}
                    >
                      Login/Signup as Student
                    </button>
                    <button
                      className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto"
                      onClick={() => setRoleSelect("counselor")}
                    >
                      Login/Signup as Counselor
                    </button>
                  </div>

                  <div className="w-full max-w-md mt-4">
                    {roleSelect === "student" && (
                      <StudentLoginSignup onLogin={handleLogin} />
                    )}
                    {roleSelect === "counselor" && (
                      <CounselorLoginSignup onLogin={handleLogin} />
                    )}
                  </div>
                </div>
              ) : user.role === "student" ? (
                <Navigate to="/student" />
              ) : (
                <Navigate to="/counselor" />
              )
            }
          />

          <Route
            path="/student"
            element={
              user?.role === "student" ? (
                <>
                  <LogoutBtn onLogout={handleLogout} />
                  <Home alias={user.name} />
                </>
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route path="/student/chat" element={<ChatRoom />} />
          <Route path="/chat" element={<ChatRoom />} />

          <Route
            path="/counselor"
            element={
              user?.role === "counselor" ? (
                <>
                  <LogoutBtn onLogout={handleLogout} />
                  <CounselorDashboard counselorName={user.name} />
                </>
              ) : (
                <Navigate to="/" />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

// 🔘 Logout Button
const LogoutBtn = ({ onLogout }) => (
  <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
    <button
      onClick={onLogout}
      className="bg-red-600 text-white px-3 py-1 sm:px-4 sm:py-2 rounded"
    >
      Logout
    </button>
  </div>
);

export default App;
