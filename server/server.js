import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/counselorAuthRoutes.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// ✅ Allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173",                  // local dev frontend
  "https://campuswellness-2.onrender.com"  // deployed frontend
];

// ✅ CORS Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman or mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "The CORS policy does not allow access from this origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Handle Preflight Requests
app.options("*", cors());

// ✅ Middleware
app.use(express.json());

// ✅ Routes
app.use("/api", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/student", studentAuthRoutes);

// ✅ Test Route
app.get("/ping", (req, res) => {
  res.send("pong");
});

// ✅ MongoDB + Socket.IO Setup
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");

    const server = createServer(app);

    // ✅ Socket.IO Server with CORS
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("🟢 New user connected:", socket.id);

      socket.on("join_room", (roomId) => {
        socket.join(roomId);
        console.log(`🔗 User ${socket.id} joined room: ${roomId}`);
      });

      socket.on("send_message", (data) => {
        console.log(`📨 ${data.alias} sent to ${data.room}: ${data.text}`);
        io.to(data.room).emit("receive_message", data);
      });

      socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
      });
    });

    server.listen(PORT, () =>
      console.log(`🚀 Server + Socket.IO running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });
