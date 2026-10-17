import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createPubSub, redis } from "../config/redis.js";
import { verifyAccessToken } from "../services/tokenService.js";
import { loadUser } from "../services/userService.js";
import { ensureAlias } from "../services/aliasService.js";
import { appendMessage, getRecentMessages, summaryKeys } from "../services/chatService.js";
import { enqueuePersist, scheduleSummary } from "../queues/index.js";
import { sessionEnd, sessionState } from "../utils/sessionTime.js";

const MAX_TEXT = 2000;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 10;
const OBJECT_ID = /^[a-f\d]{24}$/i;

export const initSocket = (httpServer) => {
  const { pub, sub } = createPubSub();

  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, methods: ["GET", "POST"], credentials: true },
    adapter: createAdapter(pub, sub), // rooms/broadcasts work across every API instance
    maxHttpBufferSize: 1e5,
  });

  // ---------------------------------------------------------- authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      const payload = await verifyAccessToken(token);
      if (payload.role !== "student" && payload.role !== "counselor") {
        return next(new Error("Invalid user role"));
      }
      const u = await loadUser(payload.role, payload.id);

      // Students are only ever identified by their random alias, never by studentId/name.
      socket.user = {
        id: String(u._id),
        role: payload.role,
        name: u.name,
        alias: payload.role === "student" ? await ensureAlias(u) : undefined,
      };
      next();
    } catch (err) {
      logger.debug({ err: err.message }, "socket auth failed");
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;
    socket.join(`user_${user.id}`); // lets logout disconnect this user's sockets

    const hits = [];
    const allowed = () => {
      const now = Date.now();
      while (hits.length && now - hits[0] > RATE_WINDOW_MS) hits.shift();
      if (hits.length >= RATE_MAX) return false;
      hits.push(now);
      return true;
    };

    // ------------------------------------------------ strict 45-minute window
    const clearEndTimer = () => {
      if (socket.endTimer) clearTimeout(socket.endTimer);
      socket.endTimer = null;
    };

    const endSession = () => {
      clearEndTimer();
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        socket.leave(`counselor_${socket.currentRoom}`);
      }
      socket.currentRoom = null;
      socket.currentBookingId = null;
      socket.sessionEndsAt = null;
      socket.emit("session_ended", "This session has ended. The conversation has been deleted.");
      socket.disconnect(true);
    };

    // ------------------------------------------------------------- join_room
    socket.on("join_room", async (payload) => {
      try {
        const { counselorId, date, time } = payload || {};
        if (
          typeof counselorId !== "string" ||
          !OBJECT_ID.test(counselorId) ||
          typeof date !== "string" ||
          typeof time !== "string"
        ) {
          return socket.emit("chat_error", "Invalid chat session details.");
        }

        const booking = await Booking.findOne({ counselor: counselorId, date, time }).lean();
        if (!booking) {
          return socket.emit("chat_error", "No valid booking found for this session.");
        }

        const owner =
          user.role === "student"
            ? String(booking.student) === user.id
            : String(booking.counselor) === user.id;
        if (!owner) {
          return socket.emit("chat_error", "You are not authorized to join this session.");
        }

        // Strict window: chat exists only between start and start + 45 minutes.
        const state = sessionState(booking.date, booking.time);
        if (state === "upcoming") {
          return socket.emit("chat_error", "This session has not started yet.");
        }
        if (state === "ended") {
          return socket.emit("chat_error", "This session has ended.");
        }
        const endsAt = sessionEnd(booking.date, booking.time).getTime();

        // The ROOM IS DERIVED BY THE SERVER from the verified booking. The client-supplied
        // roomId is ignored, so a user can never join someone else's room.
        const room = `booking-${booking._id}`;

        if (socket.currentRoom && socket.currentRoom !== room) {
          socket.leave(socket.currentRoom);
          socket.leave(`counselor_${socket.currentRoom}`);
        }
        socket.join(room);
        if (user.role === "counselor") socket.join(`counselor_${room}`);
        socket.currentRoom = room;
        socket.currentBookingId = String(booking._id);
        socket.sessionEndsAt = endsAt;

        // Close the chat automatically the moment the 45 minutes are up.
        clearEndTimer();
        socket.endTimer = setTimeout(endSession, Math.max(0, endsAt - Date.now()));

        // Replay history (Redis first, MongoDB if the buffer was lost)
        let history = await getRecentMessages(room, 100);
        if (history.length === 0) {
          const rows = await Message.find({ booking: booking._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
          history = rows.reverse().map((m) => ({
            alias: m.alias,
            text: m.text,
            role: m.role,
            room,
            createdAt: m.createdAt.toISOString(),
            timestamp: m.createdAt.toLocaleTimeString(),
          }));
        }
        socket.emit("chat_history", history);
        socket.emit("session_info", { endsAt: new Date(endsAt).toISOString() });

        if (user.role === "counselor") {
          const summary = await redis.get(summaryKeys.text(room));
          if (summary) socket.emit("receive_summary", { roomId: room, summary });
        }
      } catch (err) {
        logger.error({ err: err.message }, "join_room failed");
        socket.emit("chat_error", "Unable to join chat.");
      }
    });

    // ---------------------------------------------------------- send_message
    socket.on("send_message", async (payload) => {
      try {
        if (!socket.currentRoom || !socket.currentBookingId) {
          return socket.emit("chat_error", "You are not in an authorized chat room.");
        }
        // Re-checked on every message (defence in depth against a missed timer)
        if (!socket.sessionEndsAt || Date.now() >= socket.sessionEndsAt) {
          return endSession();
        }
        const text = typeof payload?.text === "string" ? payload.text.trim() : "";
        if (!text) return;
        if (text.length > MAX_TEXT) {
          return socket.emit("chat_error", `Messages are limited to ${MAX_TEXT} characters.`);
        }
        if (!allowed()) {
          return socket.emit("chat_error", "You're sending messages too fast. Please slow down.");
        }

        const now = new Date();
        const expireAt = new Date(socket.sessionEndsAt);
        const message = {
          // Server decides the sender identity (students: anonymous alias only)
          alias: user.role === "student" ? user.alias : user.name,
          role: user.role,
          text,
          room: socket.currentRoom,
          timestamp: now.toLocaleTimeString(),
          createdAt: now.toISOString(),
        };

        // Retention = chat duration: every copy of the conversation expires with the session.
        await appendMessage(socket.currentRoom, message, expireAt.getTime());
        io.to(socket.currentRoom).emit("receive_message", message);

        // Async work: durable storage + (debounced) AI summary happen in the worker
        enqueuePersist({
          _id: new mongoose.Types.ObjectId().toString(),
          booking: socket.currentBookingId,
          room: socket.currentRoom,
          alias: message.alias,
          role: message.role,
          text: message.text,
          createdAt: message.createdAt,
          expireAt: expireAt.toISOString(),
        }).catch((err) => logger.error({ err: err.message }, "enqueue persist failed"));

        scheduleSummary(socket.currentRoom, expireAt.getTime()).catch((err) =>
          logger.error({ err: err.message }, "schedule summary failed")
        );
      } catch (err) {
        logger.error({ err: err.message }, "send_message failed");
        socket.emit("chat_error", "Unable to send message.");
      }
    });

    socket.on("disconnect", clearEndTimer);
  });

  return io;
};
