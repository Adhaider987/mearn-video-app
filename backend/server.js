require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const friendRoutes = require("./routes/friends");
const User = require("./models/User");
const Message = require("./models/Message");
const messageRoutes = require("./routes/messages");

function parseClientOrigins() {
  const raw =
    process.env.CLIENT_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const clientOrigins = parseClientOrigins();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.set("io", io);
app.set("getSocketIdsByUserId", getSocketIdsByUserId);

// DB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.type("text").send("Video call backend is running.");
});

// Socket Helpers
const userSockets = new Map(); // userId -> Set(socketIds)

function getSocketIdsByUserId(userId) {
  return userSockets.get(userId.toString()) || new Set();
}

module.exports = { app, server, io, getSocketIdsByUserId };

io.on("connection", async (socket) => {
  const token = socket.handshake.auth.token;
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      
      if (!userSockets.has(userId.toString())) {
        userSockets.set(userId.toString(), new Set());
      }
      userSockets.get(userId.toString()).add(socket.id);
      
      // Update online status
      await User.findByIdAndUpdate(userId, { online: true });
      socket.broadcast.emit("user-status", { userId, online: true });
      
      console.log(`User ${userId} authenticated on socket ${socket.id}`);
    } catch (err) {
      console.log("Invalid token on socket connection");
    }
  }

  socket.on("join-room", (roomId, ack) => {
    if (!roomId) return;
    socket.join(roomId);
    
    // Notify others in the room
    socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });
    
    if (typeof ack === "function") ack({ ok: true, roomId });
  });

  socket.on("leave-room", (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("peer-left", { socketId: socket.id, userId });
  });

  // Private Messaging
  socket.on("send-message", async (data) => {
    const { receiverId, content, room } = data;
    if (!userId) return;

    try {
      const message = new Message({
        sender: userId,
        receiver: receiverId,
        room,
        content,
      });
      await message.save();

      const populatedMessage = await message.populate("sender", "username avatar");

      if (room) {
        // Group message
        io.to(room).emit("new-message", populatedMessage);
      } else if (receiverId) {
        // Private message
        const targetSockets = getSocketIdsByUserId(receiverId);
        targetSockets.forEach((sid) => {
          io.to(sid).emit("new-message", populatedMessage);
        });
        // Also send back to sender's other sockets
        const senderSockets = getSocketIdsByUserId(userId);
        senderSockets.forEach((sid) => {
          if (sid !== socket.id) io.to(sid).emit("new-message", populatedMessage);
        });
        socket.emit("new-message", populatedMessage);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // WebRTC Signaling (modified for multi-peer/group)
  socket.on("signal", (data) => {
    const { to, signal, roomId } = data;
    if (to) {
      // Direct signaling to a specific socket
      io.to(to).emit("signal", { from: socket.id, userId, signal });
    } else if (roomId) {
      // Broadcast signaling to room (usually for initial discover)
      socket.to(roomId).emit("signal", { from: socket.id, userId, signal });
    }
  });

  // Reactions
  socket.on("reaction", (data) => {
    const { roomId, reaction } = data;
    if (roomId) {
      socket.to(roomId).emit("reaction", { from: userId, reaction });
    }
  });

  socket.on("disconnect", async () => {
    if (userId && userSockets.has(userId)) {
      userSockets.get(userId).delete(socket.id);
      if (userSockets.get(userId).size === 0) {
        userSockets.delete(userId);
        await User.findByIdAndUpdate(userId, { online: false, lastSeen: Date.now() });
        socket.broadcast.emit("user-status", { userId, online: false });
      }
    }
    console.log("Socket disconnected:", socket.id);
  });

  // Call Signaling
  socket.on("start-call", async (data) => {
    const { targetUserId, type, roomId } = data;
    if (!userId) return;

    const sender = await User.findById(userId).select("username avatar online");
    const targetSockets = getSocketIdsByUserId(targetUserId);
    
    targetSockets.forEach(sid => {
      io.to(sid).emit("incoming-call", { sender, type, roomId });
    });
  });

  socket.on("call-response", (data) => {
    const { callerId, accept, roomId } = data;
    const callerSockets = getSocketIdsByUserId(callerId);
    
    callerSockets.forEach(sid => {
      io.to(sid).emit("call-response", { accept, roomId, responderId: userId });
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
