// index.js
const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

const PORT = process.env.PORT || 8080;
var draggablemarkerLocation = { lat: 51.988488, lng: 5.896824 };

const app = express();
app.use(express.json());

// ============== Database ==============

fs.mkdirSync("data", { recursive: true });

const db = new JsonDB(new Config("data/markers", true, true, "/"));

try {
  visitedStore = db.getData("/visited");
} catch {
  visitedStore = {};
  db.push("/visited", visitedStore, true);
}

let vosStore = {};
try {
  vosStore = db.getData("/vos");
} catch {
  vosStore = {};
  db.push("/vos", vosStore, true);
}

// ============== API Endpoints ==============

// Healthcheck
app.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/draggablemarker/location", (req, res) => {
  res.status(200).json(draggablemarkerLocation);
});

app.get("/visited", (req, res) => {
  res.json(visitedStore);
});

app.post("/visited", (req, res) => {
  const { id, visited } = req.body || {};
  if (!id || typeof visited !== "boolean")
    return res.status(400).json({ error: "id & visited required" });

  visitedStore[id] = { visited, ts: Date.now() };
  try {
    const safeId = String(id).replace(/\//g, "_");
    db.push(`/visited/${safeId}`, visitedStore[id], true);
  } catch (e) {}

  io.emit("visited:update", { id, visited: visitedStore[id].visited });
  res.json({ ok: true });
});

// ============== HTTP + Socket.IO Server ==============

const server = http.createServer(app);

// Socket.IO server
const io = new Server(server, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
});

const peers = new Map();

// ============== Socket.IO Handlers ==============

io.on("connection", (socket) => {
  let clientId = null;

  socket.emit("draggable:snapshot", draggablemarkerLocation);

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

  // Database updates
  socket.emit("visited:snapshot", visitedStore);

  socket.on("visited:set", ({ id, visited }) => {
    if (!id || typeof visited !== "boolean") return;

    visitedStore[id] = { visited, ts: Date.now() };
    try {
      const safeId = String(id).replace(/\//g, "_");
      db.push(`/visited/${safeId}`, visitedStore[id], true);
    } catch (e) {
      console.error("DB push error:", e);
    }

    socket.broadcast.emit("visited:update", {
      id,
      visited: visitedStore[id].visited,
    });
  });

  // Vos updates
  socket.emit("vos:snapshot", vosStore);

  socket.on("vos:create", (payload) => {
    const { id, lat, lng, area, startedAt, label } = payload || {};
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !area ||
      !startedAt
    )
      return;

    const newId = id;
    const safeId = String(newId).replace(/\//g, "_");

    const vos = { id: newId, lat, lng, area, startedAt, label: label || "" };
    vosStore[newId] = vos;

    try {
      db.push(`/vos/${safeId}`, vos, true);
    } catch (e) {
      console.error("DB push vos error:", e);
    }

    socket.broadcast.emit("vos:upsert", vos);
    socket.emit("vos:upsert", vos);
  });

  socket.on("vos:update", (payload) => {
    const { id } = payload || {};
    if (!id || !vosStore[id]) return;

    const merged = { ...vosStore[id], ...payload };
    vosStore[id] = merged;

    try {
      const safeId = String(id).replace(/\//g, "_");
      db.push(`/vos/${safeId}`, merged, true);
    } catch (e) {
      console.error("DB push vos update error:", e);
    }

    socket.broadcast.emit("vos:upsert", merged);
    socket.emit("vos:upsert", merged);
  });

  socket.on("vos:remove", ({ id }) => {
    if (!id || !vosStore[id]) return;
    delete vosStore[id];
    try {
      const safeId = String(id).replace(/\//g, "_");
      db.delete(`/vos/${safeId}`);
    } catch (e) {
      console.error("DB remove vos error:", e);
    }
    socket.broadcast.emit("vos:remove", { id });
    socket.emit("vos:remove", { id });
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

  // Marker updates
  socket.on("draggable:update", ({ lat, lng }) => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    draggablemarkerLocation = { lat, lng };
    socket.broadcast.emit("draggable:update", draggablemarkerLocation);
  });

  socket.on("disconnect", () => {
    if (clientId && peers.has(clientId)) {
      peers.delete(clientId);
      socket.broadcast.emit("peer:leave", { clientId });
    }
  });
});

// ============== Start Server ==============

server.listen(PORT, () => {
  console.log(`Web API + Socket.IO listening on :${PORT}`);
});
