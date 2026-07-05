# CampusWellness

CampusWellness is a full-stack anonymous counseling platform designed to help students connect with counselors in a safe and confidential way. The platform allows students to register, book counseling sessions, join anonymous real-time chats during active session windows, and enables counselors to view scheduled sessions and receive AI-generated conversation summaries.

## Features

* Student registration and login
* Counselor registration and login
* JWT-based authentication
* Anonymous counseling session booking
* Active, upcoming, and previous session tracking
* Real-time chat using Socket.IO
* Room-based private chat sessions
* AI-generated counseling summaries for counselors
* Responsive React frontend
* MongoDB database integration
* Secure password hashing using bcrypt

## Tech Stack

**Frontend**

* React
* React Router
* Axios
* Tailwind CSS
* Socket.IO Client

**Backend**

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* bcryptjs
* Socket.IO
* Groq/OpenAI-compatible API

## System Architecture

```text
Student / Counselor
        |
        v
React Frontend
        |
        v
Express.js Backend
        |
        v
MongoDB Database
```

For real-time chat:

```text
Student ChatRoom  <---->  Socket.IO Server  <---->  Counselor ChatRoom
                              |
                              v
                       AI Summary Service
```

## Project Structure

```text
CampusWellness
├── server
│   ├── server.js
│   ├── package.json
│   ├── models
│   │   ├── Student.js
│   │   ├── Counselor.js
│   │   └── Booking.js
│   ├── routes
│   │   ├── studentAuthRoutes.js
│   │   ├── counselorAuthRoutes.js
│   │   └── bookingRoutes.js
│   ├── controllers
│   │   ├── studentAuthController.js
│   │   └── counselorAuthController.js
│   └── services
│       └── aiSummaryService.js
│
└── client
    └── src
        ├── App.jsx
        ├── main.jsx
        ├── config.js
        └── components
            ├── StudentLoginSignup.jsx
            ├── CounselorLoginSignup.jsx
            ├── Home.jsx
            ├── BookingForm.jsx
            ├── CounselorDashboard.jsx
            └── ChatRoom.jsx
```

## Core Workflow

### Student Flow

1. Student signs up or logs in using a student ID and password.
2. After login, the student can book a counseling session by selecting counselor name, date, time, and optional issue.
3. The student can view active and upcoming sessions.
4. Chat becomes available only during the 45-minute active session window.
5. During the session, the student can chat anonymously with the counselor.

### Counselor Flow

1. Counselor signs up or logs in using email and password.
2. After login, the counselor can view active, upcoming, and previous sessions.
3. The counselor can join active sessions.
4. During chat, the counselor receives AI-generated summaries of the conversation.

## Authentication

The project uses JWT-based authentication. Passwords are securely hashed before being stored in MongoDB.

* Student passwords are hashed using a Mongoose pre-save hook.
* Counselor passwords are hashed using bcrypt before saving.
* JWT tokens are generated after successful login.

## Real-Time Chat

Socket.IO is used for real-time communication between students and counselors.

Each counseling session has a unique room ID created using:

```js
const room = `${counselor}_${date}_${time}`;
```

Messages are emitted to the specific room, so conversations remain isolated between the correct student and counselor.

## Chat Message Buffering

Chat messages are temporarily stored in an in-memory buffer for AI summary generation.

The structure is:

```text
HashMap<String, Array<Message>>
```

Example:

```js
{
  "counselor_2026-07-05_10:00": [
    {
      sender: "student123",
      text: "I am feeling stressed",
      timestamp: "..."
    }
  ]
}
```

Here:

* `roomId` is the key
* the value is an array of message objects

## AI Summary

The AI summary service takes the buffered chat messages, formats them into a conversation, and sends them to an AI model. The generated summary focuses on:

* Emotional state
* Stress concerns
* Academic issues
* Social concerns

Summaries are sent only to the counselor.

## API Endpoints

### Student Auth

```text
POST /api/student/register
POST /api/student/login
```

### Counselor Auth

```text
POST /api/counselorAuth/signup
POST /api/counselorAuth/login
```

### Booking

```text
POST /api/book
GET /api/bookings/:counselor
GET /api/student/:alias
```

### Test Route

```text
GET /ping
```

## Environment Variables

Create a `.env` file in the backend folder:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
```

## Installation and Setup

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Future Improvements

* Add stronger validation for booking date and time
* Add email notifications or reminders


## Conclusion

CampusWellness provides a secure and anonymous platform for student counseling. It combines REST APIs for authentication and booking, Socket.IO for real-time chat, MongoDB for persistent data, and AI-powered summaries to support counselors during sessions.



