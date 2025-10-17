// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// Healthcheck
app.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const server = http.createServer(app);

// Socket.IO server
const io = new Server(server, {
  // nginx en front-end zitten op hetzelfde origin; CORS kan simpel blijven
  path: "/socket.io",
  transports: ["websocket", "polling"],
});

// In-memory presence (clientId -> { name, lat, lng, accuracy, ts })
const peers = new Map();

io.on("connection", (socket) => {
  let clientId = null;

  socket.on("hello", ({ clientId: cid, name }) => {
    clientId = cid;
    if (!clientId) return;

    const existing = peers.get(clientId) || {};
    peers.set(clientId, {
      name: name || existing.name || "Anoniem",
      lat: existing.lat,
      lng: existing.lng,
      accuracy: existing.accuracy,
      ts: existing.ts || Date.now(),
    });

    socket.emit("peers:snapshot", Object.fromEntries(peers.entries()));

    socket.broadcast.emit("peer:join", {
      clientId,
      name: name || "Anoniem",
    });
  });

  // Locatie updates
  socket.on(
    "location:update",
    ({ clientId: cid, name, lat, lng, accuracy }) => {
      if (!cid || typeof lat !== "number" || typeof lng !== "number") return;

      clientId = cid;
      const ts = Date.now();
      peers.set(clientId, { name: name || "Anoniem", lat, lng, accuracy, ts });

      socket.broadcast.emit("peer:update", {
        clientId,
        name: name || "Anoniem",
        lat,
        lng,
        accuracy,
        ts,
      });
    }
  );

  socket.on("disconnect", () => {
    if (clientId && peers.has(clientId)) {
      peers.delete(clientId);
      socket.broadcast.emit("peer:leave", { clientId });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Web API + Socket.IO listening on :${PORT}`);
});
