import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import BACKEND_URL from "../config";

const ChatRoom = () => {
  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [summary, setSummary] =
    useState("");

  const [chatError, setChatError] =
    useState("");

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


  const displayAlias =
    isCounselor
      ? user.name
      : user.studentId;


  // ==================================================
  // LOAD LOCAL MESSAGES
  // ==================================================

  useEffect(() => {
    const saved =
      localStorage.getItem(
        `chat_${room}`
      );

    if (saved) {
      try {
        setMessages(
          JSON.parse(saved)
        );
      } catch (error) {
        console.error(
          "Invalid saved chat:",
          error
        );

        localStorage.removeItem(
          `chat_${room}`
        );
      }
    }
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


    const socket =
      io(BACKEND_URL, {
        auth: {
          token,
        },
      });


    socketRef.current =
      socket;


    // ==================================================
    // CONNECTION ERROR
    // ==================================================

    socket.on(
      "connect_error",
      (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );

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

    socket.on(
      "receive_message",
      (data) => {
        setMessages(
          (prev) => {
            const updated = [
              ...prev,
              data,
            ];

            localStorage.setItem(
              `chat_${room}`,
              JSON.stringify(
                updated
              )
            );

            return updated;
          }
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
        "receive_message"
      );

      socket.off(
        "receive_summary"
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


      <h2 className="text-xl font-bold mb-4 text-center">
        🗣️ Anonymous Chat
      </h2>


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
                    user.role &&
                  msg.alias ===
                    displayAlias;


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
                          msg.timestamp
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
          className="flex-grow px-3 py-2 rounded bg-white text-black"
          placeholder="Type a message..."
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
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-semibold"
        >
          Send
        </button>

      </div>

    </div>
  );
};

export default ChatRoom;