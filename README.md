# MERN Video App

A full-stack real-time video calling and chat application built with the MERN stack (MongoDB, Express, React, Node.js) and WebRTC for peer-to-peer video/audio communication.

---

## Features

- **User Authentication** — Sign up / log in with JWT-based auth (tokens valid for 7 days)
- **Friend System** — Send, accept, and manage friend requests; search for users
- **Real-Time Messaging** — Private one-to-one chat powered by Socket.IO
- **Video & Audio Calls** — Peer-to-peer WebRTC calls with ICE/TURN server support
- **Online Presence** — Live online/offline status and last-seen indicators
- **In-Call Reactions** — Send emoji reactions during a video call
- **Device Controls** — Toggle camera and microphone during a call
- **ngrok Tunnel Support** — Built-in Vite proxy config for testing on mobile / external networks

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19, Vite, TailwindCSS v4, React Router v7, TanStack Query v5, Framer Motion, Socket.IO Client |
| Backend   | Node.js, Express 4, Socket.IO, JSON Web Tokens, bcryptjs |
| Database  | MongoDB via Mongoose |
| Real-Time | WebRTC (browser native), Socket.IO signaling |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [MongoDB](https://www.mongodb.com/) (local instance or [Atlas](https://cloud.mongodb.com/) cluster)
- npm v9 or later (comes with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Adhaider987/mearn-video-app.git
cd mearn-video-app
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in the required values:

```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/video-app

# Secret used to sign JWTs (use a long random string in production)
JWT_SECRET=your_super_secret_key

# Comma-separated browser origins allowed for CORS + Socket.IO
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Port the Express server listens on (default: 5000)
PORT=5000
```

### 3. Install backend dependencies

```bash
# inside /backend
npm install
```

### 4. Configure the frontend

```bash
cd ../frontend
cp .env.example .env
```

`frontend/.env` is optional for local development. Set `VITE_SOCKET_URL` only when the API is served from a different origin (e.g. a separate ngrok tunnel):

```env
# Optional – only needed when API and frontend have different public URLs
# VITE_SOCKET_URL=https://your-api-tunnel.ngrok-free.dev

# Optional – custom ICE/TURN servers (JSON array)
# VITE_ICE_SERVERS_JSON=[{"urls":"turn:turn.example.com:3478","username":"user","credential":"pass"}]
```

### 5. Install frontend dependencies

```bash
# inside /frontend
npm install
```

### 6. Run the application

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev   # uses node --watch for auto-reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev   # Vite dev server at http://localhost:5173
```

The app is now available at **http://localhost:5173**.

---

## Project Structure

```
mearn-video-app/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema (auth, friends, online status)
│   │   └── Message.js       # Message schema (private & group)
│   ├── routes/
│   │   ├── auth.js          # POST /signup, POST /login, GET /me
│   │   ├── friends.js       # Friend request & management endpoints
│   │   └── messages.js      # Fetch message history
│   ├── server.js            # Express app + Socket.IO + WebRTC signaling
│   ├── .env.example         # Environment variable template
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/             # Axios API helpers
    │   ├── components/      # Reusable UI components
    │   │   ├── ChatArea.jsx
    │   │   ├── ChatLayout.jsx
    │   │   ├── FriendsSidebar.jsx
    │   │   ├── VideoCall.jsx
    │   │   └── VideoCallOverlay.jsx
    │   ├── context/         # React context providers
    │   ├── pages/
    │   │   ├── AuthPage.jsx     # Login / Sign-up page
    │   │   ├── Dashboard.jsx    # Main chat & call dashboard
    │   │   └── FindFriends.jsx  # User search & friend requests
    │   ├── signalingSocket.js   # Socket.IO singleton
    │   └── main.jsx
    ├── .env.example
    ├── vite.config.js       # Vite + proxy config for ngrok support
    └── package.json
```

---

## API Endpoints

### Auth — `/api/auth`
| Method | Path      | Description            |
|--------|-----------|------------------------|
| POST   | /signup   | Register a new user    |
| POST   | /login    | Log in, receive JWT    |
| GET    | /me       | Get current user info  |

### Friends — `/api/friends`
| Method | Path | Description                     |
|--------|------|---------------------------------|
| GET    | /    | List friends & pending requests |
| POST   | /request/:id | Send a friend request   |
| POST   | /accept/:id  | Accept a friend request |
| DELETE | /:id         | Remove a friend         |

### Messages — `/api/messages`
| Method | Path          | Description                     |
|--------|---------------|---------------------------------|
| GET    | /:friendId    | Fetch private message history   |

---

## Socket.IO Events

| Event           | Direction        | Description                              |
|-----------------|------------------|------------------------------------------|
| `join-room`     | Client → Server  | Join a WebRTC call room                  |
| `leave-room`    | Client → Server  | Leave a call room                        |
| `signal`        | Bidirectional    | WebRTC offer / answer / ICE candidate    |
| `send-message`  | Client → Server  | Send a private message                   |
| `new-message`   | Server → Client  | Receive a new message                    |
| `start-call`    | Client → Server  | Initiate an incoming-call notification   |
| `incoming-call` | Server → Client  | Notify target user of incoming call      |
| `call-response` | Bidirectional    | Accept or reject a call                  |
| `hang-up`       | Client → Server  | End an active call                       |
| `reaction`      | Bidirectional    | Send / receive in-call emoji reaction    |
| `device-status` | Bidirectional    | Camera / mic toggle notification         |
| `user-status`   | Server → Client  | Online / offline status update           |
| `peer-joined`   | Server → Client  | Another peer joined the room             |
| `peer-left`     | Server → Client  | A peer left the room                     |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable         | Required | Default                                       | Description                              |
|------------------|----------|-----------------------------------------------|------------------------------------------|
| `MONGODB_URI`    | ✅       | —                                             | MongoDB connection string                |
| `JWT_SECRET`     | ✅       | —                                             | Secret for signing JWTs                  |
| `CLIENT_ORIGINS` | ✅       | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed CORS origins     |
| `PORT`           | ❌       | `5000`                                        | Port the Express server listens on       |

### Frontend (`frontend/.env`)

| Variable               | Required | Description                                                |
|------------------------|----------|------------------------------------------------------------|
| `VITE_SOCKET_URL`      | ❌       | API origin when different from Vite dev server             |
| `VITE_ICE_SERVERS_JSON`| ❌       | JSON array of extra ICE/TURN servers for WebRTC            |

---

## Contributing

Pull requests are reviewed and merged by the repository owner only.  
Please open an issue first if you plan a large change.

---

## License

This project is open source. See [LICENSE](LICENSE) for details (if present).