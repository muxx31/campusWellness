import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BookingForm from './BookingForm';
import { useNavigate } from 'react-router-dom';
import BACKEND_URL from '../config';

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
    <div className="bg-[url(/images/image2.png)] bg-cover bg-fixed min-h-screen w-full flex flex-col items-center 
                    p-4 sm:p-6 pt-20 sm:pt-6">
      {/* ↑ Added pt-20 on mobile → shifts content slightly down so Logout button won't overlap */}

      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-center text-black rounded-2xl text-shadow-teal-200 text-shadow-lg">
        Welcome to Campus Wellness
      </h1>

      <div className="bg-teal rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col md:flex-row gap-4 md:gap-6 
                      w-full max-w-6xl h-auto md:h-[80vh] overflow-hidden">
        {/* Left Panel */}
        <div className="w-full md:w-1/2 bg-gradient-to-r from-teal-950 to-teal-700 shadow-2xl 
                        p-4 sm:p-6 rounded-xl overflow-auto flex flex-col justify-center">
          <div className="text-lg sm:text-xl md:text-2xl text-teal-200 text-center mb-4">
            It's completely human to have hard days — you're not alone.
          </div>
          <BookingForm alias={alias} onBookingSuccess={fetchStudentBookings} />
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 bg-gradient-to-r from-teal-700 to-teal-400 
                        rounded-xl overflow-hidden flex flex-col">
          <h2 className="text-lg sm:text-xl font-semibold mb-2 text-teal-100 text-center md:text-left">
            📅 Your Upcoming Session
          </h2>

          {bookings.length > 0 ? (
            <div className="space-y-4 overflow-y-auto pr-1 sm:pr-2 flex-1">
              {bookings.map((b) => (
                <div
                  key={`${b.date}-${b.time}-${b.counselor}`}
                  className="p-3 sm:p-4 rounded bg-gradient-to-r from-gray-500 to-gray-400 
                             text-white shadow"
                >
                  <p><strong>Counselor:</strong> {b.counselor}</p>
                  <p><strong>Date:</strong> {b.date}</p>
                  <p><strong>Time:</strong> {b.time}</p>
                  <p><strong>Issue:</strong> {b.issue || 'Not specified'}</p>

                  <button
                    disabled={!isSessionActive(b.date, b.time)}
                    onClick={() => joinChat(b)}
                    className={`mt-3 w-full sm:w-auto px-4 py-2 rounded text-sm sm:text-base transition ${
                      isSessionActive(b.date, b.time)
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
            <p className="italic text-white text-center mt-4">
              No upcoming or active bookings.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
};

export default Home;
