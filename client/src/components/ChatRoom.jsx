import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import BACKEND_URL from '../config'; // ✅ import backend URL

const ChatRoom = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const session = JSON.parse(localStorage.getItem('chatSession'));

  if (!session) {
    return <div className="p-6 text-center text-red-600 font-semibold">❌ Missing session details</div>;
  }

  const { alias, counselor, date, time } = session;
  const room = `${counselor}_${date}_${time}`;

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`chat_${room}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    }
  }, [room]);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(BACKEND_URL); // ✅ dynamic backend URL
    }

    const socket = socketRef.current;

    socket.emit('join_room', room);
    console.log(`Joined room: ${room}`);

    socket.on('receive_message', (data) => {
      setMessages((prev) => {
        const updated = [...prev, data];
        localStorage.setItem(`chat_${room}`, JSON.stringify(updated)); // 🔐 Save to storage
        return updated;
      });
    });

    return () => {
      socket.off('receive_message');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const msg = {
      alias,
      text: message,
      room,
      timestamp: new Date().toLocaleTimeString(),
    };

    socketRef.current.emit('send_message', msg);
    setMessage('');
  };

  return (
    <div className="p-4 bg-gray-700 min-h-screen text-white">
      {/* 🔙 Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 bg-gray-300 hover:bg-gray-400 text-white px-3 py-1 rounded"
      >
        ← Back
      </button>

      <h2 className="text-xl font-bold mb-4 text-center">🗣️ Anonymous Chat</h2>

      <div className="h-[60vh] overflow-y-auto p-3 bg-white text-black rounded shadow mb-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-2 ${msg.alias === alias ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-3 py-1 rounded-lg ${msg.alias === alias ? 'bg-blue-200' : 'bg-green-100'}`}>
              <span className="font-semibold">{msg.alias === alias ? 'You' : msg.alias}</span>: {msg.text}
              <div className="text-xs text-gray-600">{msg.timestamp}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-grow px-3 py-2 rounded bg-white text-black"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
