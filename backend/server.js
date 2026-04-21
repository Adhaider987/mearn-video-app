require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.type("text").send("Video call signaling server is running.");
});

function countSocketsInRoom(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

function normalizeRoomId(roomId) {
  if (typeof roomId !== "string") return "";
  return roomId.trim();
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId, ack) => {
    const rid = normalizeRoomId(roomId);
    if (!rid) {
      socket.emit("room-error", { message: "Invalid room id." });
      if (typeof ack === "function") ack({ ok: false, error: "invalid" });
      return;
    }

    // Leave any previous signaling rooms so one socket cannot occupy multiple rooms (e.g. after changing room id).
    for (const room of [...socket.rooms]) {
      if (room !== socket.id) {
        socket.leave(room);
      }
    }

    const count = countSocketsInRoom(rid);
    if (count >= 2) {
      socket.emit("room-error", {
        message: "Room is full (max 2 participants).",
      });
      if (typeof ack === "function") ack({ ok: false, error: "full" });
      return;
    }

    socket.join(rid);
    console.log(`${socket.id} joined room ${rid} (size now ${countSocketsInRoom(rid)})`);
    socket.emit("joined-room", { roomId: rid });
    if (typeof ack === "function") ack({ ok: true, roomId: rid });
  });

  socket.on("leave-room", (roomId) => {
    const rid = normalizeRoomId(roomId);
    if (!rid) return;
    socket.to(rid).emit("peer-left", { socketId: socket.id });
    socket.leave(rid);
  });

  socket.on("call-request", ({ roomId, displayName }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid) return;
    const size = countSocketsInRoom(rid);
    if (size < 2) {
      socket.emit("call-failed", {
        reason: "no-peer",
        message: "Nobody else is in this room yet. Ask them to enter the room first.",
      });
      return;
    }
    socket.to(rid).emit("incoming-call", {
      from: socket.id,
      displayName:
        typeof displayName === "string" && displayName.trim()
          ? displayName.trim()
          : "Someone",
      roomId: rid,
    });
  });

  socket.on("call-accept", ({ roomId, callerId }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid || !callerId) return;
    io.to(callerId).emit("call-accepted", {
      from: socket.id,
      roomId: rid,
    });
  });

  socket.on("call-reject", ({ roomId, callerId }) => {
    if (!callerId) return;
    const rid = normalizeRoomId(roomId);
    io.to(callerId).emit("call-rejected", {
      from: socket.id,
      roomId: rid,
    });
  });

  socket.on("call-cancel", ({ roomId }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid) return;
    socket.to(rid).emit("call-cancelled", {
      from: socket.id,
      roomId: rid,
    });
  });

  socket.on("offer", ({ roomId, offer }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid || !offer) return;
    socket.to(rid).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ roomId, answer }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid || !answer) return;
    socket.to(rid).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    const rid = normalizeRoomId(roomId);
    if (!rid) return;
    // `candidate` may be null (end-of-candidates); still forward it.
    if (candidate === undefined) return;
    socket.to(rid).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      socket.to(roomId).emit("peer-disconnected", { socketId: socket.id });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://localhost:${PORT} (all interfaces)`);
  console.log(`CLIENT_ORIGINS: ${clientOrigins.join(", ")}`);
});
