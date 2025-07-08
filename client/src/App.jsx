import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import StudentLoginSignup from './components/StudentLoginSignup';
import CounselorLoginSignup from './components/CounselorLoginSignup';
import Home from './components/Home';
import CounselorDashboard from './components/CounselorDashboard';
import ChatRoom from './components/ChatRoom';

function App() {
  const [user, setUser] = useState(null);
  const [roleSelect, setRoleSelect] = useState('');

  // ✅ On app load, try restoring user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ✅ On login, save user to localStorage too
  const handleLogin = ({ role, name }) => {
    const userData = { role, name };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setRoleSelect('');
    localStorage.removeItem('user');
    localStorage.removeItem('chatSession');
  };

  return (
    <Router>
      <div className="min-h-screen min-w-screen">
        <Routes>
          <Route
            path="/"
            element={
              !user ? (
                <div className="bg-[url(/images/Cover.jpeg)] min-h-screen flex flex-col items-center justify-center gap-6 p-6">
                  <h2 className="bg-white rounded-4xl text-8xl font-semibold text-black">
                    Campus Wellness
                  </h2>
                  <div className="flex gap-4">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded"
                      onClick={() => setRoleSelect('student')}
                    >
                      Login/Signup as Student
                    </button>
                    <button
                      className="bg-green-600 text-white px-4 py-2 rounded"
                      onClick={() => setRoleSelect('counselor')}
                    >
                      Login/Signup as Counselor
                    </button>
                  </div>

                  {roleSelect === 'student' && (
                    <StudentLoginSignup onLogin={handleLogin} />
                  )}
                  {roleSelect === 'counselor' && (
                    <CounselorLoginSignup onLogin={handleLogin} />
                  )}
                </div>
              ) : user.role === 'student' ? (
                <Navigate to="/student" />
              ) : (
                <Navigate to="/counselor" />
              )
            }
          />

          <Route
            path="/student"
            element={
              user?.role === 'student' ? (
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
              user?.role === 'counselor' ? (
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
  <div className="absolute top-4 right-4">
    <button
      onClick={onLogout}
      className="bg-red-600 text-white px-3 py-1 rounded"
    >
      Logout
    </button>
  </div>
);

export default App;

