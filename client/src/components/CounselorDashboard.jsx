

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CounselorDashboard = ({ counselorName: propCounselor }) => {
  const [counselorName, setCounselorName] = useState(
    () => propCounselor || localStorage.getItem('counselorName')
  );
  const [bookings, setBookings] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [missed, setMissed] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    if (propCounselor) {
      localStorage.setItem('counselorName', propCounselor);
      setCounselorName(propCounselor);
    } else if (!counselorName) {
      navigate('/login'); // or your fallback route
    }
  }, [propCounselor, counselorName, navigate]);


  const fetchBookings = async () => {
    try {
      const res = await axios.get(`http://localhost:5001/api/bookings/${counselorName}`);
      const all = res.data;

      const now = new Date();
      const sorted = all.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

      let active = null;
      const future = [];
      const past = [];

      sorted.forEach(b => {
        const start = new Date(`${b.date}T${b.time}`);
        const end = new Date(start.getTime() + 45 * 60000);

        if (now >= start && now <= end && !active) {
          active = b;
        } else if (start > now) {
          future.push(b);
        } else if (end < now) {
          past.push(b);
        }
      });

      setActiveBooking(active);
      setUpcoming(future); // ✅ All future bookings shown here
      setMissed(past.reverse());
    } catch (err) {
      console.error('Fetch error:', err.response?.data || err.message);
      alert('Could not fetch bookings');
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleJoinChat = (booking) => {
    localStorage.setItem('chatSession', JSON.stringify({
      alias: counselorName,
      counselor: booking.counselor,
      date: booking.date,
      time: booking.time,
    }));
    navigate('/chat');
  };

  const renderBookingCard = (b, allowJoin = true) => {
    const start = new Date(`${b.date}T${b.time}`);
    const end = new Date(start.getTime() + 45 * 60000);
    const now = new Date();
    const isActive = now >= start && now <= end;

    return (
      <div
        key={b._id}
        className="border p-4 rounded shadow bg-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4"
      >
        <div className="text-left text-white">
          <p><strong>Alias:</strong> {b.alias}</p>
          <p><strong>Date:</strong> {b.date}</p>
          <p><strong>Time:</strong> {b.time}</p>
          <p><strong>Issue:</strong> {b.issue || 'Not specified'}</p>
        </div>

        {allowJoin && (
          <button
            disabled={!isActive}
            onClick={() => handleJoinChat(b)}
            className={`mt-3 sm:mt-0 px-3 py-1 rounded ${isActive
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
          >
            {isActive ? 'Join Chat' : 'Chat Inactive'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[url(/images/image2.png)] p-6 min-w-screen min-h-screen mx-auto space-y-6">
      <h2 className="text-5xl font-bold mb-4 ml-20 mr-210 bg-teal-400 text-teal-950 text-shadow-lg text-shadow-teal-100">Welcome, Dr. {counselorName}</h2>
      <div className="bg-teal  ml-12 mr-12 rounded-2xl shadow-lg p-2 flex flex-col md:flex-row gap-4 h-[85vh] overflow-hidden">
    
        <div className='w-2xl'>
        <div className='text-3xl p-9 bg-gradient-to-r from-teal-950 to-teal-700 m-5 rounded-xl text-teal-100 text-center'>Your presence today might be the light in someone’s darkness.</div>
          {/* Active Session */}
          <div className="bg-gradient-to-r from-teal-950 to-teal-700 m-5 h-[200px] p-4 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-2 text-teal-100">Active Chat Session</h3>
            {activeBooking ? (
              renderBookingCard(activeBooking)
            ) : (
              <p className="text-teal-100 italic text-center">No active chats.</p>
            )}
          </div>

          {/* Upcoming Sessions with scroll */}
          <div className="bg-gradient-to-r from-teal-950 to-teal-700 m-5 p-4 rounded-xl shadow max-h-[200px] text-black overflow-y-auto">
            <h3 className="text-xl font-semibold mb-2 text-teal-100">Upcoming Sessions</h3>
            {upcoming.length > 0 ? (
              upcoming.map((b) => renderBookingCard(b))
            ) : (
              <p className="text-white italic">No upcoming sessions.</p>
            )}
          </div>
        </div>

        {/* Previous Sessions */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-400 m-5 w-xl p-4 rounded-xl shadow overflow-y-auto">
          <h3 className="text-xl font-semibold mb-2 text-teal-50">Previous Sessions</h3>
          {missed.length > 0 ? (
            missed.map((b) => renderBookingCard(b, false))
          ) : (
            <p className="text-white italic text-center">No Previous sessions</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CounselorDashboard;
