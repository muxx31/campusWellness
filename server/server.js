import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
//import dotenv from "dotenv";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/counselorAuthRoutes.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import { createServer } from "http";
import { Server } from "socket.io";
import counselorAuthRoutes from "./routes/counselorAuthRoutes.js";
import {
  addMessageToBuffer,
  getSessionMessages,
  generateSummary,
} from "./services/aiSummaryService.js";

const summaryIntervals = {};
const lastSummaryCount = {};
const failedSummaryAttempts = {};
const counselorSockets = {};
//dotenv.config();

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
app.use("/api/counselorAuth", counselorAuthRoutes);

// ✅ Test Route
app.get("/ping", (req, res) => {
  res.send("pong");
});

// ✅ MongoDB + Socket.IO Setup
mongoose
  .connect(MONGO_URI)
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

      socket.on("join_room", ({ roomId, role }) => {

        console.log("ROOM JOIN EVENT RECEIVED");
        console.log("ROOM ID:", roomId);

        socket.join(roomId);
        if (role === "counselor") {
          socket.join(`counselor_${roomId}`);
        }
        if (role === "counselor") {
          counselorSockets[roomId] = socket.id;

          console.log(
            `🧠 Counselor socket saved for room ${roomId}`
          );
        }

        console.log(`🔗 User ${socket.id} joined room: ${roomId}`);

        if (!summaryIntervals[roomId]) {

          console.log("STARTING SUMMARY TIMER");

          summaryIntervals[roomId] = setInterval(async () => {

            console.log("INTERVAL RUNNING");

            const messages = getSessionMessages(roomId);

            console.log("MESSAGES:", messages);

            if (messages.length === 0) return;

            // ✅ Prevent repeated summaries
            if (
              lastSummaryCount[roomId] === messages.length
            ) {
              return;
            }

            const summary = await generateSummary(roomId);

            console.log(`🧠 AI SUMMARY FOR ROOM ${roomId}:`);
            console.log(summary);
            io.to(`counselor_${roomId}`).emit(
              "receive_summary",
              summary
            );

            const counselorSocketId = counselorSockets[roomId];

            if (counselorSocketId) {

              io.to(counselorSocketId).emit(
                "receive_summary",
                {
                  roomId,
                  summary,
                }
              );

            }

            // ✅ If Gemini failed
            if (summary === "Failed to generate summary.") {

              if (!failedSummaryAttempts[roomId]) {
                failedSummaryAttempts[roomId] = 0;
              }

              failedSummaryAttempts[roomId]++;

              console.log(
                `❌ Failed Attempts: ${failedSummaryAttempts[roomId]}`
              );

              // ✅ Stop retries after 3 failures
              if (failedSummaryAttempts[roomId] >= 3) {

                console.log(
                  `🛑 Stopping summary interval for room ${roomId}`
                );

                clearInterval(summaryIntervals[roomId]);

                delete summaryIntervals[roomId];
                delete failedSummaryAttempts[roomId];
                delete lastSummaryCount[roomId];
              }

              return;
            }

            // ✅ Summary succeeded
            lastSummaryCount[roomId] = messages.length;

            // ✅ Reset failure count
            // ✅ Reset failure count
            delete failedSummaryAttempts[roomId];

          }, 180000);

        }

      });

      socket.on("send_message", async (data) => {

        addMessageToBuffer(
          data.room,
          data.alias,
          data.text
        );

        const messages = getSessionMessages(data.room);

        console.log(messages);

        io.to(data.room).emit("receive_message", data);


      });

      socket.on("disconnect", () => {
        for (const roomId in counselorSockets) {

          if (counselorSockets[roomId] === socket.id) {
        
            delete counselorSockets[roomId];
        
            console.log(
              `🗑️ Removed counselor socket for room ${roomId}`
            );
        
          }
        
        }        
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
