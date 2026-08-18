import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import bookingRoutes from "./routes/bookingRoutes.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import counselorAuthRoutes from "./routes/counselorAuthRoutes.js";

import Booking from "./models/Booking.js";
import Student from "./models/Student.js";
import Counselor from "./models/Counselor.js";

import jwt from "jsonwebtoken";

import { createServer } from "http";
import { Server } from "socket.io";

import {
  addMessageToBuffer,
  getSessionMessages,
  generateSummary,
} from "./services/aiSummaryService.js";

const summaryIntervals = {};
const lastSummaryCount = {};
const failedSummaryAttempts = {};
const counselorSockets = {};

const app = express();

const PORT =
  process.env.PORT || 5001;

const MONGO_URI =
  process.env.MONGO_URI;


// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://campuswellness-2.onrender.com",
];

app.use(
  cors({
    origin: function (
      origin,
      callback
    ) {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.indexOf(
          origin
        ) === -1
      ) {
        const msg =
          "The CORS policy does not allow access from this origin.";

        return callback(
          new Error(msg),
          false
        );
      }

      return callback(
        null,
        true
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
    ],

    credentials: true,
  })
);

app.options(
  "*",
  cors()
);

app.use(
  express.json()
);


// ======================================================
// REST API ROUTES
// ======================================================

app.use(
  "/api",
  bookingRoutes
);

app.use(
  "/api/student",
  studentAuthRoutes
);

app.use(
  "/api/counselorAuth",
  counselorAuthRoutes
);


// ======================================================
// TEST ROUTE
// ======================================================

app.get(
  "/ping",
  (req, res) => {
    res.send("pong");
  }
);


// ======================================================
// MONGODB + SOCKET.IO
// ======================================================

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(
      "✅ Connected to MongoDB"
    );

    const server =
      createServer(app);


    // ==================================================
    // SOCKET.IO
    // ==================================================

    const io = new Server(
      server,
      {
        cors: {
          origin:
            allowedOrigins,

          methods: [
            "GET",
            "POST",
          ],
        },
      }
    );


    // ==================================================
    // SOCKET AUTHENTICATION
    // ==================================================

    io.use(
      async (
        socket,
        next
      ) => {
        try {
          const token =
            socket.handshake.auth
              ?.token;

          if (!token) {
            return next(
              new Error(
                "Authentication required"
              )
            );
          }

          const decoded =
            jwt.verify(
              token,
              process.env.JWT_SECRET
            );

          if (
            !decoded.id ||
            !decoded.role
          ) {
            return next(
              new Error(
                "Invalid authentication token"
              )
            );
          }


          // ----------------------------------------------
          // STUDENT
          // ----------------------------------------------

          if (
            decoded.role ===
            "student"
          ) {
            const student =
              await Student.findById(
                decoded.id
              ).select(
                "-password"
              );

            if (!student) {
              return next(
                new Error(
                  "Student not found"
                )
              );
            }

            socket.user = {
              id: student._id.toString(),
              role: "student",
              name: student.name,
              studentId:
                student.studentId,
            };

            return next();
          }


          // ----------------------------------------------
          // COUNSELOR
          // ----------------------------------------------

          if (
            decoded.role ===
            "counselor"
          ) {
            const counselor =
              await Counselor.findById(
                decoded.id
              ).select(
                "-password"
              );

            if (!counselor) {
              return next(
                new Error(
                  "Counselor not found"
                )
              );
            }

            socket.user = {
              id: counselor._id.toString(),
              role: "counselor",
              name: counselor.name,
              email: counselor.email,
            };

            return next();
          }

          return next(
            new Error(
              "Invalid user role"
            )
          );
        } catch (error) {
          console.error(
            "Socket authentication error:",
            error.message
          );

          return next(
            new Error(
              "Invalid or expired token"
            )
          );
        }
      }
    );


    // ==================================================
    // SOCKET CONNECTION
    // ==================================================

    io.on(
      "connection",
      (socket) => {
        console.log(
          "🟢 Authenticated socket connected:",
          socket.id,
          socket.user.role,
          socket.user.id
        );


        // ==================================================
        // JOIN ROOM
        // ==================================================

        socket.on(
          "join_room",
          async ({
            roomId,
            counselorId,
            date,
            time,
          }) => {
            try {
              console.log(
                "ROOM JOIN REQUEST"
              );

              console.log(
                "Room:",
                roomId
              );

              console.log(
                "User:",
                socket.user
              );


              if (
                !roomId ||
                !counselorId ||
                !date ||
                !time
              ) {
                socket.emit(
                  "chat_error",
                  "Invalid chat session details."
                );

                return;
              }


              // --------------------------------------------
              // FIND THE EXACT BOOKING
              // --------------------------------------------

              const booking =
                await Booking.findOne(
                  {
                    counselor:
                      counselorId,

                    date,

                    time,
                  }
                );


              if (!booking) {
                socket.emit(
                  "chat_error",
                  "No valid booking found for this session."
                );

                return;
              }


              // --------------------------------------------
              // STUDENT AUTHORIZATION
              // --------------------------------------------

              if (
                socket.user.role ===
                "student"
              ) {
                const isOwner =
                  booking.student.toString() ===
                  socket.user.id;

                if (!isOwner) {
                  socket.emit(
                    "chat_error",
                    "You are not authorized to join this session."
                  );

                  return;
                }
              }


              // --------------------------------------------
              // COUNSELOR AUTHORIZATION
              // --------------------------------------------

              if (
                socket.user.role ===
                "counselor"
              ) {
                const isOwner =
                  booking.counselor.toString() ===
                  socket.user.id;

                if (!isOwner) {
                  socket.emit(
                    "chat_error",
                    "You are not authorized to join this session."
                  );

                  return;
                }
              }


              // --------------------------------------------
              // JOIN ROOM
              // --------------------------------------------

              socket.join(
                roomId
              );

              socket.currentRoom =
                roomId;

              socket.currentBookingId =
                booking._id.toString();


              // --------------------------------------------
              // COUNSELOR SOCKET
              // --------------------------------------------

              if (
                socket.user.role ===
                "counselor"
              ) {
                socket.join(
                  `counselor_${roomId}`
                );

                counselorSockets[
                  roomId
                ] = socket.id;

                console.log(
                  `🧠 Counselor socket saved for room ${roomId}`
                );
              }


              console.log(
                `🔗 ${socket.user.role} ${socket.user.id} joined room ${roomId}`
              );


              // --------------------------------------------
              // START AI SUMMARY TIMER
              // --------------------------------------------

              if (
                !summaryIntervals[
                  roomId
                ]
              ) {
                console.log(
                  "STARTING SUMMARY TIMER"
                );

                summaryIntervals[
                  roomId
                ] =
                  setInterval(
                    async () => {
                      try {
                        console.log(
                          "INTERVAL RUNNING"
                        );

                        const messages =
                          getSessionMessages(
                            roomId
                          );

                        console.log(
                          "MESSAGES:",
                          messages
                        );

                        if (
                          messages.length ===
                          0
                        ) {
                          return;
                        }


                        // Prevent repeated summaries
                        if (
                          lastSummaryCount[
                            roomId
                          ] ===
                          messages.length
                        ) {
                          return;
                        }


                        const summary =
                          await generateSummary(
                            roomId
                          );


                        console.log(
                          `🧠 AI SUMMARY FOR ROOM ${roomId}:`
                        );

                        console.log(
                          summary
                        );


                        io.to(
                          `counselor_${roomId}`
                        ).emit(
                          "receive_summary",
                          summary
                        );


                        const counselorSocketId =
                          counselorSockets[
                            roomId
                          ];


                        if (
                          counselorSocketId
                        ) {
                          io.to(
                            counselorSocketId
                          ).emit(
                            "receive_summary",
                            {
                              roomId,
                              summary,
                            }
                          );
                        }


                        // Gemini/API failure
                        if (
                          summary ===
                          "Failed to generate summary."
                        ) {
                          if (
                            !failedSummaryAttempts[
                              roomId
                            ]
                          ) {
                            failedSummaryAttempts[
                              roomId
                            ] = 0;
                          }

                          failedSummaryAttempts[
                            roomId
                          ]++;


                          console.log(
                            `❌ Failed Attempts: ${failedSummaryAttempts[roomId]}`
                          );


                          if (
                            failedSummaryAttempts[
                              roomId
                            ] >= 3
                          ) {
                            console.log(
                              `🛑 Stopping summary interval for room ${roomId}`
                            );

                            clearInterval(
                              summaryIntervals[
                                roomId
                              ]
                            );

                            delete summaryIntervals[
                              roomId
                            ];

                            delete failedSummaryAttempts[
                              roomId
                            ];

                            delete lastSummaryCount[
                              roomId
                            ];
                          }

                          return;
                        }


                        // Summary succeeded
                        lastSummaryCount[
                          roomId
                        ] =
                          messages.length;

                        delete failedSummaryAttempts[
                          roomId
                        ];
                      } catch (
                        summaryError
                      ) {
                        console.error(
                          "Summary interval error:",
                          summaryError
                        );
                      }
                    },
                    180000
                  );
              }
            } catch (error) {
              console.error(
                "Join room error:",
                error
              );

              socket.emit(
                "chat_error",
                "Unable to join chat."
              );
            }
          }
        );


        // ==================================================
        // SEND MESSAGE
        // ==================================================

        socket.on(
          "send_message",
          async ({
            text,
          }) => {
            try {
              if (
                !socket.currentRoom ||
                !socket.currentBookingId
              ) {
                socket.emit(
                  "chat_error",
                  "You are not in an authorized chat room."
                );

                return;
              }


              if (
                !text ||
                !text.trim()
              ) {
                return;
              }


              // --------------------------------------------
              // RECHECK BOOKING OWNERSHIP
              // --------------------------------------------

              const booking =
                await Booking.findById(
                  socket.currentBookingId
                );


              if (!booking) {
                socket.emit(
                  "chat_error",
                  "Booking no longer exists."
                );

                return;
              }


              let authorized =
                false;


              if (
                socket.user.role ===
                "student"
              ) {
                authorized =
                  booking.student.toString() ===
                  socket.user.id;
              }


              if (
                socket.user.role ===
                "counselor"
              ) {
                authorized =
                  booking.counselor.toString() ===
                  socket.user.id;
              }


              if (!authorized) {
                socket.emit(
                  "chat_error",
                  "You are not authorized to send messages in this session."
                );

                return;
              }


              // --------------------------------------------
              // SERVER DECIDES SENDER IDENTITY
              // --------------------------------------------

              const alias =
                socket.user.role ===
                "student"
                  ? socket.user.studentId
                  : socket.user.name;


              const message = {
                alias,
                text:
                  text.trim(),
                room:
                  socket.currentRoom,
                timestamp:
                  new Date().toLocaleTimeString(),
                role:
                  socket.user.role,
              };


              addMessageToBuffer(
                socket.currentRoom,
                alias,
                text.trim()
              );


              const messages =
                getSessionMessages(
                  socket.currentRoom
                );

              console.log(
                messages
              );


              io.to(
                socket.currentRoom
              ).emit(
                "receive_message",
                message
              );
            } catch (
              error
            ) {
              console.error(
                "Send message error:",
                error
              );

              socket.emit(
                "chat_error",
                "Unable to send message."
              );
            }
          }
        );


        // ==================================================
        // DISCONNECT
        // ==================================================

        socket.on(
          "disconnect",
          () => {
            for (const roomId in counselorSockets) {
              if (
                counselorSockets[
                  roomId
                ] === socket.id
              ) {
                delete counselorSockets[
                  roomId
                ];

                console.log(
                  `🗑️ Removed counselor socket for room ${roomId}`
                );
              }
            }

            console.log(
              "🔴 User disconnected:",
              socket.id
            );
          }
        );
      }
    );


    // ==================================================
    // START SERVER
    // ==================================================

    server.listen(
      PORT,
      () =>
        console.log(
          `🚀 Server + Socket.IO running at http://localhost:${PORT}`
        )
    );
  })
  .catch(
    (err) => {
      console.error(
        "❌ MongoDB connection error:",
        err.message
      );
    }
  );