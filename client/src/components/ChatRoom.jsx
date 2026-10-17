import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import BACKEND_URL from "../config";
import { refreshAccessToken } from "../api";

const ChatRoom = () => {
  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [summary, setSummary] =
    useState("");

  const [chatError, setChatError] =
    useState("");

  const [ended, setEnded] =
    useState(false);

  const [endsAt, setEndsAt] =
    useState(null);

  const [now, setNow] =
    useState(() => Date.now());

  const socketRef =
    useRef(null);

  const navigate =
    useNavigate();


  // ==================================================
  // GET USER + CHAT SESSION
  // ==================================================

  const storedUser =
    localStorage.getItem(
      "user"
    );

  const storedSession =
    localStorage.getItem(
      "chatSession"
    );


  if (
    !storedUser ||
    !storedSession
  ) {
    return (
      <div className="p-6 text-center text-red-600 font-semibold">
        ❌ Missing authentication or session details
      </div>
    );
  }


  const user =
    JSON.parse(storedUser);

  const session =
    JSON.parse(
      storedSession
    );


  const {
    counselorId,
    date,
    time,
  } = session;


  // ==================================================
  // IMPORTANT:
  // ROOM ID USES COUNSELOR ID
  // NOT COUNSELOR NAME
  // ==================================================

  const room =
    `${counselorId}_${date}_${time}`;


  // ==================================================
  // ROLE COMES FROM AUTHENTICATED USER
  // ==================================================

  const isCounselor =
    user.role ===
    "counselor";


  // Own messages are recognised by role: a room only ever has one student and one counselor.


  // ==================================================
  // RETENTION: conversations are never kept in the browser.
  // The server deletes the chat when the 45-minute session ends.
  // ==================================================

  useEffect(() => {
    localStorage.removeItem(`chat_${room}`); // cleanup of caches from older versions

    return () => {
      localStorage.removeItem(`chat_${room}`);
    };
  }, [room]);


  // ==================================================
  // SOCKET CONNECTION
  // ==================================================

  useEffect(() => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) {
      setChatError(
        "Authentication token missing."
      );

      return;
    }


    // websocket-only: no sticky sessions needed behind a load balancer.
    // `auth` is a function so reconnects always use the latest access token.
    const socket =
      io(BACKEND_URL, {
        transports: ["websocket"],
        withCredentials: true,
        auth: (cb) =>
          cb({
            token:
              localStorage.getItem(
                "token"
              ),
          }),
      });

    let triedRefresh = false;


    socketRef.current =
      socket;


    // ==================================================
    // CONNECTION ERROR
    // ==================================================

    socket.on(
      "connect_error",
      async (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );

        // Access tokens last 15 min: renew once and retry
        if (
          !triedRefresh &&
          /token/i.test(
            error.message
          )
        ) {
          triedRefresh = true;

          try {
            await refreshAccessToken();
            socket.connect();
            return;
          } catch {
            /* fall through to error */
          }
        }

        setChatError(
          "Unable to authenticate with chat server."
        );
      }
    );


    // ==================================================
    // CHAT ERROR
    // ==================================================

    socket.on(
      "chat_error",
      (error) => {
        console.error(
          "Chat error:",
          error
        );

        setChatError(
          error
        );
      }
    );


    // ==================================================
    // JOIN ROOM
    // ==================================================

    socket.on(
      "connect",
      () => {
        console.log(
          "Socket connected:",
          socket.id
        );


        socket.emit(
          "join_room",
          {
            roomId:
              room,

            counselorId:
              counselorId,

            date,
            time,
          }
        );


        console.log(
          `Requested room: ${room}`
        );
      }
    );


    // ==================================================
    // RECEIVE MESSAGE
    // ==================================================

    // Server replays the stored conversation when you (re)join a session
    socket.on(
      "chat_history",
      (history) => {
        if (!Array.isArray(history)) return;

        setMessages(history);
      }
    );


    socket.on(
      "receive_message",
      (data) => {
        setMessages(
          (prev) => [
            ...prev,
            data,
          ]
        );
      }
    );


    // ==================================================
    // STRICT 45-MINUTE WINDOW
    // ==================================================

    socket.on(
      "session_info",
      (info) => {
        if (info?.endsAt) {
          setEndsAt(
            new Date(info.endsAt)
          );
        }
      }
    );

    socket.on(
      "session_ended",
      (text) => {
        setEnded(true);
        setMessages([]);
        setSummary("");
        setChatError(
          typeof text === "string"
            ? text
            : "This session has ended."
        );
      }
    );


    // ==================================================
    // RECEIVE SUMMARY
    // ==================================================

    socket.on(
      "receive_summary",
      (data) => {
        console.log(
          "SUMMARY RAW:",
          data
        );


        const finalSummary =
          typeof data ===
          "string"
            ? data
            : data?.summary ||
              "";


        setSummary(
          finalSummary
        );
      }
    );


    return () => {
      socket.off(
        "connect"
      );

      socket.off(
        "connect_error"
      );

      socket.off(
        "chat_error"
      );

      socket.off(
        "chat_history"
      );

      socket.off(
        "receive_message"
      );

      socket.off(
        "receive_summary"
      );

      socket.off(
        "session_info"
      );

      socket.off(
        "session_ended"
      );

      socket.disconnect();

      socketRef.current =
        null;
    };
  }, [
    room,
    counselorId,
    date,
    time,
  ]);


  // ==================================================
  // COUNTDOWN (server decides when the session ends)
  // ==================================================

  useEffect(() => {
    if (!endsAt || ended) return;

    const timer = setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => clearInterval(timer);
  }, [endsAt, ended]);

  const secondsLeft =
    endsAt
      ? Math.max(
          0,
          Math.floor(
            (endsAt.getTime() -
              now) /
              1000
          )
        )
      : null;

  const countdown =
    secondsLeft === null
      ? ""
      : `${String(
          Math.floor(
            secondsLeft / 60
          )
        ).padStart(2, "0")}:${String(
          secondsLeft % 60
        ).padStart(2, "0")}`;


  // ==================================================
  // SEND MESSAGE
  // ==================================================

  const sendMessage =
    () => {
      if (
        !message.trim()
      ) {
        return;
      }


      if (
        !socketRef.current ||
        !socketRef.current.connected
      ) {
        setChatError(
          "Chat connection is not ready."
        );

        return;
      }


      // IMPORTANT:
      // We send ONLY the message.
      // Server decides:
      // alias
      // role
      // room
      // identity
      socketRef.current.emit(
        "send_message",
        {
          text:
            message.trim(),
        }
      );


      setMessage("");
    };


  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="p-4 bg-gray-700 min-h-screen text-white">

      {/* Back */}
      <button
        onClick={() =>
          navigate(-1)
        }
        className="mb-4 bg-gray-300 hover:bg-gray-400 text-white px-3 py-1 rounded"
      >
        ← Back
      </button>


      <h2 className="text-xl font-bold mb-1 text-center">
        🗣️ Anonymous Chat
      </h2>

      {!ended && countdown && (
        <p className="mb-4 text-center text-teal-200 text-sm">
          ⏱ Time left in this session: {countdown} — the conversation is deleted when it ends
        </p>
      )}


      {chatError && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded text-center">
          {chatError}
        </div>
      )}


      <div className="flex flex-col lg:flex-row gap-4">

        {/* Chat */}
        <div className="flex-[3]">

          <div className="h-[60vh] overflow-y-auto p-3 bg-white text-black rounded shadow mb-4">

            {messages.map(
              (
                msg,
                idx
              ) => {

                const isOwnMessage =
                  msg.role ===
                  user.role;


                return (
                  <div
                    key={idx}
                    className={`mb-2 ${
                      isOwnMessage
                        ? "text-right"
                        : "text-left"
                    }`}
                  >

                    <div
                      className={`inline-block px-3 py-1 rounded-lg ${
                        isOwnMessage
                          ? "bg-blue-200"
                          : "bg-green-100"
                      }`}
                    >

                      <span className="font-semibold">
                        {isOwnMessage
                          ? "You"
                          : "Anonymous"}
                      </span>

                      :{" "}
                      {
                        msg.text
                      }

                      <div className="text-xs text-gray-600">
                        {
                          msg.createdAt
                            ? new Date(
                                msg.createdAt
                              ).toLocaleTimeString()
                            : msg.timestamp
                        }
                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </div>


        {/* Counselor Summary */}
        {isCounselor && (
          <div className="flex-1 bg-white text-black rounded shadow p-4 h-[60vh]">

            <h3 className="text-lg font-bold mb-3">
              🧠 AI Summary
            </h3>

            <div className="text-sm whitespace-pre-wrap">
              {summary ||
                "Waiting for AI summary..."}
            </div>

          </div>
        )}

      </div>


      {/* Message Input */}
      <div className="flex gap-2">

        <input
          className="flex-grow px-3 py-2 rounded bg-white text-black disabled:opacity-50"
          disabled={ended}
          placeholder={
            ended
              ? "Session ended"
              : "Type a message..."
          }
          value={message}
          onChange={(e) =>
            setMessage(
              e.target.value
            )
          }

          onKeyDown={(e) => {
            if (
              e.key ===
              "Enter"
            ) {
              sendMessage();
            }
          }}
        />

        <button
          onClick={
            sendMessage
          }
          disabled={ended}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>

      </div>

    </div>
  );
};

export default ChatRoom;