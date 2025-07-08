import React, { useState } from 'react';

const StudentLoginSignup = ({ onLogin }) => {
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const trimmedAlias = alias.trim();
    if (trimmedAlias) {
      const userData = { role: 'student', name: trimmedAlias };

      // ✅ Save to localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      // ✅ Call parent login handler
      onLogin(userData);
    } else {
      setError('Alias is required');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-6 bg-gray-800 p-6 rounded-2xl shadow">
      <h2 className="text-xl font-bold mb-4 text-center text-white">Student Login</h2>
      <input
        type="text"
        placeholder="Enter your alias"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        className="w-full border px-3 py-2 rounded mb-4"
      />
      <button
        onClick={handleLogin}
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        Continue
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default StudentLoginSignup;
