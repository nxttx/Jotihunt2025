// index.js
const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// ============== Database ==============
fs.mkdirSync("data", { recursive: true });
const db = new JsonDB(new Config("data/markers", true, true, "/"));

function safeKey(id) {
  return String(id).replace(/\//g, "_");
}

// --- Stores (persisted) ---
let visitedStore = {};
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

let draggablemarkerLocation = { lat: 51.988488, lng: 5.896824 };
try {
  const d = db.getData("/draggable");
  if (typeof d?.lat === "number" && typeof d?.lng === "number") {
    draggablemarkerLocation = d;
  } else {
    db.push("/draggable", draggablemarkerLocation, true);
  }
} catch {
  db.push("/draggable", draggablemarkerLocation, true);
}

let uiStore = { circlesVisible: true };
try {
  const u = db.getData("/ui");
  if (typeof u?.circlesVisible === "boolean") {
    uiStore = u;
  } else {
    db.push("/ui", uiStore, true);
  }
} catch {
  db.push("/ui", uiStore, true);
}

// ============== Helpers ==============

// Maak een “graph” van de VOS’en per area:
// - order: array met ids oud -> nieuw
// - newestId
// - coords: polyline volgorde
function computeVosGraph(store) {
  const byArea = new Map();
  Object.values(store || {}).forEach((v) => {
    if (!v?.area) return;
    if (!byArea.has(v.area)) byArea.set(v.area, []);
    byArea.get(v.area).push(v);
  });

  const areas = {};
  for (const [area, arr] of byArea.entries()) {
    arr.sort(
      (A, B) => (Date.parse(A.startedAt) || 0) - (Date.parse(B.startedAt) || 0)
    );
    const order = arr.map((v) => v.id);
    const newestId = order.length ? order[order.length - 1] : null;
    const coords = arr.map((v) => [v.lat, v.lng]);
    areas[area] = { order, newestId, coords };
  }

  return {
    version: Date.now(),
    areas,
  };
}

function persistVosStoreHard() {
  // hard overwrite (belt & braces) to prevent stale keys
  db.push("/vos", vosStore, true);
}

// ============== API Endpoints ==============

app.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/draggablemarker/location", (req, res) => {
  res.status(200).json(draggablemarkerLocation);
});

app.get("/visited", (req, res) => res.json(visitedStore));
app.get("/vos", (req, res) => res.json(vosStore));
app.get("/vos/graph", (req, res) => res.json(computeVosGraph(vosStore)));
app.get("/ui", (req, res) => res.json(uiStore));

// REST fallback to delete (handig voor debug)
app.delete("/vos/:id", (req, res) => {
  const id = req.params.id;
  if (!id || !vosStore[id]) return res.status(404).json({ error: "not found" });
  delete vosStore[id];
  try {
    db.delete(`/vos/${safeKey(id)}`);
  } catch (e) {
    console.error("DB delete vos (path) error:", e);
  }
  try {
    persistVosStoreHard();
  } catch (e) {
    console.error("DB overwrite /vos error:", e);
  }
  io.emit("vos:remove", { id });
  io.emit("vos:graph", computeVosGraph(vosStore));
  return res.json({ ok: true });
});

// ============== HTTP + Socket.IO Server ==============

const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
});

const peers = new Map();

// ============== Socket.IO Handlers ==============
io.on("connection", (socket) => {
  let clientId = null;

  // Init snapshots voor nieuwe client
  socket.emit("draggable:snapshot", draggablemarkerLocation);
  socket.emit("visited:snapshot", visitedStore);
  socket.emit("vos:snapshot", vosStore);
  socket.emit("vos:graph", computeVosGraph(vosStore));
  socket.emit("ui:circles:snapshot", {
    circlesVisible: uiStore.circlesVisible,
  });

  // Peer “hello”
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
    socket.broadcast.emit("peer:join", { clientId, name: name || "Anoniem" });
  });

  // ===== Visited =====
  socket.on("visited:set", ({ id, visited }) => {
    if (!id || typeof visited !== "boolean") return;

    visitedStore[id] = { visited, ts: Date.now() };
    try {
      db.push(`/visited/${safeKey(id)}`, visitedStore[id], true);
    } catch (e) {
      console.error("DB push visited error:", e);
    }

    io.emit("visited:update", { id, visited: visitedStore[id].visited });
  });

  // ===== VOS create / update / remove =====
  socket.on("vos:create", (payload) => {
    const { id, lat, lng, area, startedAt, label, circleEnabled } =
      payload || {};
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !area ||
      !startedAt ||
      !id
    )
      return;

    const vos = {
      id,
      lat,
      lng,
      area,
      startedAt,
      label: label || "",
      circleEnabled: circleEnabled !== false, // default aan
    };

    vosStore[id] = vos;

    try {
      db.push(`/vos/${safeKey(id)}`, vos, true);
    } catch (e) {
      console.error("DB push vos error:", e);
    }
    try {
      persistVosStoreHard();
    } catch (e) {
      console.error("DB overwrite /vos error:", e);
    }

    io.emit("vos:upsert", vos);
    io.emit("vos:graph", computeVosGraph(vosStore));
  });

  socket.on("vos:update", (payload) => {
    const { id } = payload || {};
    if (!id || !vosStore[id]) return;

    const merged = { ...vosStore[id], ...payload };
    if ("circleEnabled" in payload)
      merged.circleEnabled = !!payload.circleEnabled;
    vosStore[id] = merged;

    try {
      db.push(`/vos/${safeKey(id)}`, merged, true);
    } catch (e) {
      console.error("DB push vos update error:", e);
    }
    try {
      persistVosStoreHard();
    } catch (e) {
      console.error("DB overwrite /vos error:", e);
    }

    io.emit("vos:upsert", merged);
    io.emit("vos:graph", computeVosGraph(vosStore));
  });

  socket.on("vos:remove", ({ id }) => {
    if (!id || !vosStore[id]) return;

    delete vosStore[id];

    try {
      db.delete(`/vos/${safeKey(id)}`);
    } catch (e) {
      console.error("DB delete vos (path) error:", e);
    }
    try {
      persistVosStoreHard();
    } catch (e) {
      console.error("DB overwrite /vos error:", e);
    }

    io.emit("vos:remove", { id });
    io.emit("vos:graph", computeVosGraph(vosStore));
  });

  // ===== UI: global cirkels-toggle (persisted) =====
  socket.on("ui:circles:set", ({ circlesVisible }) => {
    if (typeof circlesVisible !== "boolean") return;

    uiStore.circlesVisible = circlesVisible;
    try {
      db.push("/ui", uiStore, true);
    } catch (e) {
      console.error("DB push ui error:", e);
    }

    io.emit("ui:circles:set", { circlesVisible });
    io.emit("vos:graph", computeVosGraph(vosStore));
  });

  // ===== Locatie updates =====
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

  // ===== Draggable marker (persisted) =====
  socket.on("draggable:update", ({ lat, lng }) => {
    if (typeof lat !== "number" || typeof lng !== "number") return;

    draggablemarkerLocation = { lat, lng };
    try {
      db.push("/draggable", draggablemarkerLocation, true);
    } catch (e) {
      console.error("DB push draggable error:", e);
    }

    io.emit("draggable:update", draggablemarkerLocation);
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
