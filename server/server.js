const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// ✅ CORS Configuration (Allow Only Your Frontend Domain)
app.use(
  cors({
    origin: 'https://campusWellness-2.onrender.com', // your frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// ✅ Handle Preflight Requests (Important for POST/PUT/DELETE)
app.options('*', cors());

// Middleware
app.use(express.json());

// Routes
app.use('/api', bookingRoutes);
app.use('/api/auth', authRoutes);

// Test route
app.get('/ping', (req, res) => {
  res.send('pong');
});

// MongoDB connection and Socket.IO setup
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');

    const http = require('http');
    const { Server } = require('socket.io');
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: 'https://campuswellness-2.onrender.com', // ✅ Allow frontend for sockets too
        methods: ['GET', 'POST'],
      },
    });

    // ✅ Socket.IO logic
    io.on('connection', (socket) => {
      console.log('🟢 New user connected:', socket.id);

      socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`🔗 User ${socket.id} joined room: ${roomId}`);
      });

      socket.on('send_message', (data) => {
        console.log(`📨 ${data.alias} sent to ${data.room}: ${data.text}`);
        io.to(data.room).emit('receive_message', data); // 👈 broadcast to room
      });

      socket.on('disconnect', () => {
        console.log('🔴 User disconnected:', socket.id);
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server + Socket.IO running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
