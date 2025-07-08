import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BookingForm from './BookingForm';
import { useNavigate } from 'react-router-dom';
import BACKEND_URL from '../config'; // ✅ Import backend base URL

const Home = ({ alias }) => {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchStudentBookings = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/student/${alias}`);
      const now = new Date();

      const active = res.data.filter(b => {
        const start = new Date(`${b.date}T${b.time}`);
        const end = new Date(start.getTime() + 45 * 60000);
        return now >= start && now <= end;
      });

      const future = res.data.filter(b => new Date(`${b.date}T${b.time}`) > now);

      const sorted = [...active, ...future].sort(
        (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)
      );

      setBookings(sorted);
    } catch (err) {
      console.error('Booking fetch error:', err);
      setError('Could not fetch student bookings');
    }
  };

  useEffect(() => {
    if (alias) fetchStudentBookings();
  }, [alias]);

  const isSessionActive = (date, time) => {
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + 45 * 60000);
    const now = new Date();
    return now >= start && now <= end;
  };

  const joinChat = (booking) => {
    localStorage.setItem(
      'chatSession',
      JSON.stringify({
        alias,
        counselor: booking.counselor,
        date: booking.date,
        time: booking.time,
      })
    );
    navigate('/student/chat');
  };

  return (
    <div className="bg-[url(/images/image2.png)] min-w-screen min-h-screen justify-items-center bg-fixed p-6">
      <h1 className="text-3xl font-bold mb-4 w-fit text-center rounded-2xl text-black text-shadow-teal-200 text-shadow-lg">Welcome to Campus Wellness</h1>

      <div className="bg-teal  ml-12 mr-12 rounded-2xl shadow-lg p-4 flex flex-col md:flex-row gap-4 h-[80vh] overflow-hidden">
        {/* Left Panel - Session Status */}
        <div className="w-full md:w-1/2 bg-gradient-to-r from-teal-950 to-teal-700 shadow-2xl p-4 rounded-xl overflow-auto">
          <div className="text-3xl p-9 text-teal-200 text-center">It's completely human to have hard days — you're not alone.</div>
          <BookingForm alias={alias} onBookingSuccess={fetchStudentBookings} />
        </div>

        {/* Right Panel - Booking Form */}
        <div className="w-full md:w-1/2 p-4 bg-gradient-to-r from-teal-700 to-teal-400 rounded-xl overflow-hidden">
          <h2 className="text-xl font-semibold mb-2 text-teal-100">📅 Your Upcoming Session</h2>

          {bookings.length > 0 ? (
            <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 2.5rem)' }}>
              {bookings.map((b) => (
                <div key={`${b.date}-${b.time}-${b.counselor}`} className="p-3 rounded bg-gradient-to-r from-gray-500 to-gray-400 text-white shadow">
                  <p><strong>Counselor:</strong> {b.counselor}</p>
                  <p><strong>Date:</strong> {b.date}</p>
                  <p><strong>Time:</strong> {b.time}</p>
                  <p><strong>Issue:</strong> {b.issue || 'Not specified'}</p>

                  <button
                    disabled={!isSessionActive(b.date, b.time)}
                    onClick={() => joinChat(b)}
                    className={`mt-2 px-4 py-1 rounded ${isSessionActive(b.date, b.time)
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-400 cursor-not-allowed'
                      }`}
                  >
                    {isSessionActive(b.date, b.time) ? 'Join Chat' : 'Chat Inactive'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="italic text-white text-center">No upcoming or active bookings.</p>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default Home;
