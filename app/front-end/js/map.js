// =====================
// Hoofdstuk: Basis kaart
// =====================
const map = L.map("map").setView([51.988488, 5.896824], 8);
let myLocationMarker;
let draggableMarker;

const VOS_SPEED_KMPH = 6;
const VOS_SPEED_MPS = VOS_SPEED_KMPH * (1000 / 3600);

// =====================
// Hoofdstuk: Helpers
// =====================
function radiusFromStart(startedAtISO) {
  const t0 = Date.parse(startedAtISO);
  if (!Number.isFinite(t0)) return 0;
  const dtSec = Math.max(0, (Date.now() - t0) / 1000);
  return dtSec * VOS_SPEED_MPS; // meters
}

function markerId(lat, lon) {
  return `${lat},${lon}`;
}

function applyVisitedStyle(marker, visited) {
  marker.setOpacity(visited ? 0.5 : 1);
}

// =====================
// Hoofdstuk: State
// =====================
const vosLayers = new Map(); // id -> { marker, circle, data }
const markerById = new Map(); // location markers
const visitedState = new Map();
const peerMarkers = new Map();

// =====================
// Hoofdstuk: Init kaart + tilelayer + events
// =====================
(function initMap() {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // klik -> nieuwe vos
  map.on("click", (e) => openVosModal(e.latlng.lat, e.latlng.lng));

  // socket verbinding starten als beschikbaar
  window.SocketAPI?.connect?.();

  // Draggable updates doorgeven (fallback als functie nog niet bestond)
  if (
    window.SocketAPI &&
    typeof window.SocketAPI.updateDraggable !== "function"
  ) {
    window.SocketAPI.updateDraggable = function (lat, lng) {
      if (window.SocketAPI.socket?.connected) {
        window.SocketAPI.socket.emit("draggable:update", { lat, lng });
      }
    };
  }
})();

// =====================
// Hoofdstuk: Locatie (eigen device)
// =====================
(function initLocation() {
  map.on("locationfound", onLocationFound);
  map.on("locationerror", onLocationError);
  map.locate({ enableHighAccuracy: true });

  setInterval(() => {
    map.locate({ enableHighAccuracy: true });

    if (myLocationMarker) {
      const { lat, lng } = myLocationMarker.getLatLng();
      window.SocketAPI?.sendLocation?.(lat, lng);
    }

    // VOS radii bijwerken
    vosLayers.forEach(({ circle, data }) =>
      circle.setRadius(radiusFromStart(data.startedAt))
    );
  }, 5000);
})();

function onLocationFound(e) {
  if (myLocationMarker) map.removeLayer(myLocationMarker);
  myLocationMarker = L.marker(e.latlng, { icon: App.Icons.Current }).addTo(map);
  window.SocketAPI?.sendLocation?.(e.latlng.lat, e.latlng.lng, e.accuracy);
}

function onLocationError(e) {
  console.warn("Geolocation error:", e?.message || e);
}

// =====================
// Hoofdstuk: "Peers" (andere clients)
// =====================
function upsertPeerMarker(id, name, latlng) {
  let m = peerMarkers.get(id);
  if (!m) {
    m = L.circleMarker(latlng, { radius: 7 }).addTo(map);
    m.bindTooltip(name || "Unknown", {
      permanent: true,
      direction: "top",
      offset: [0, -8],
    });
    peerMarkers.set(id, m);
  } else {
    m.setLatLng(latlng);
    if (m.getTooltip()) m.setTooltipContent(name || "Unknown");
  }
}

// =====================
// Hoofdstuk: Subscriptie‑markers (Jotihunt API)
// =====================
(async function loadMarkers() {
  try {
    const res = await fetch("https://jotihunt.nl/api/2.0/subscriptions");
    const json = await res.json();
    (json?.data || []).forEach((loc) => {
      const icon = App.areaIcon(loc.area);
      const addr = `${loc.street} ${loc.housenumber} ${loc.housenumber_addition}, ${loc.city}, ${loc.postcode}`;
      createLocationMarker(loc.lat, loc.long, icon, loc.name, addr, loc.area);
    });
  } catch (err) {
    console.error("Kan subscription markers niet laden:", err);
  }
})();

function createLocationMarker(lat, lon, icon, naam, locatie, area) {
  if (area === "Undefined") area = "Marker";
  const id = markerId(lat, lon);
  const m = L.marker([lat, lon], { icon }).addTo(map);
  markerById.set(id, m);
  applyVisitedStyle(m, visitedState.get(id) === true);

  m.on("click", () => {
    const v = visitedState.get(id) === true;
    const btnLabel = v ? "Visited \u2713" : "Visited";
    const html = `
      <b>${naam}</b> - <b>${area}</b><br/>
      (${locatie}, <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener">Google Maps</a>)
      <div class="popup-actions">
        <button class="btn btn-outline btn-xs visit-btn" data-id="${id}" data-visited="${
      v ? "true" : "false"
    }">${btnLabel}</button>
      </div>
    `;
    L.popup().setLatLng([lat, lon]).setContent(html).openOn(map);
  });
}

// =====================
// Hoofdstuk: Draggable marker (server‑gedeelde pin)
// =====================
(async function loadDraggableMarker() {
  try {
    const res = await fetch("/api/draggablemarker/location");
    const data = await res.json();
    setOrCreateDraggable(data.lat, data.lng);
  } catch (e) {
    console.warn("Draggable locatie niet beschikbaar");
  }
})();

function setOrCreateDraggable(lat, lng) {
  if (!draggableMarker) {
    draggableMarker = L.marker([lat, lng], {
      icon: App.Icons.Pin,
      draggable: true,
    }).addTo(map);

    draggableMarker.on("dragend", (e) => {
      const p = e.target.getLatLng();
      window.SocketAPI?.updateDraggable?.(p.lat, p.lng);
    });

    draggableMarker.on("click", (e) => {
      const p = e.target.getLatLng();
      L.popup()
        .setLatLng(p)
        .setContent(
          `<b>Draggable Marker</b><br>` +
            `<a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Maps</a>`
        )
        .openOn(map);
    });
  } else {
    draggableMarker.setLatLng([lat, lng]);
  }
}

// =====================
// Hoofdstuk: VOS (teken/upsert/verwijder)
// =====================
function upsertVosOnMap(v) {
  const id = v.id;
  const pos = [v.lat, v.lng];
  const icon = App.areaIcon(v.area);

  let entry = vosLayers.get(id);
  if (!entry) {
    const marker = L.marker(pos, { icon }).addTo(map);

    marker.on("click", () => {
      const cur = vosLayers.get(id)?.data || v;
      const r = radiusFromStart(cur.startedAt);
      const startLocal = new Date(cur.startedAt).toLocaleString();
      const html = `
        <b>Vos</b> ${cur.label ? `— ${cur.label}` : ""}<br/>
        <b>Area:</b> ${cur.area}<br/>
        <b>Gestart:</b> ${startLocal}<br/>
        <b>Radius:</b> ~${Math.round(r)} m<br/>
        <div class="popup-actions">
          <button class="btn btn-outline btn-xs vos-edit" data-id="${id}">Edit</button>
          <button class="btn btn-danger  btn-xs vos-remove" data-id="${id}">Verwijder</button>
          <a class="btn btn-outline btn-xs" href="https://www.google.com/maps/search/?api=1&query=${
            cur.lat
          },${cur.lng}" target="_blank" rel="noopener">Google Maps</a>
        </div>`;
      L.popup().setLatLng([cur.lat, cur.lng]).setContent(html).openOn(map);
    });

    const color = App.areaColor(v.area);
    const circle = L.circle(pos, {
      radius: radiusFromStart(v.startedAt),
      color: v.area === "Oscar" ? "#333" : color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.15,
    }).addTo(map);

    vosLayers.set(id, { marker, circle, data: { ...v } });
  } else {
    entry.data = { ...entry.data, ...v };
    entry.marker.setLatLng(pos).setIcon(icon);
    const c = App.areaColor(entry.data.area);
    entry.circle.setLatLng(pos).setStyle({
      color: entry.data.area === "Oscar" ? "#333" : c,
      fillColor: c,
    });
    entry.circle.setRadius(radiusFromStart(entry.data.startedAt));
  }
}

function removeVos(ids) {
  ids.forEach((id) => {
    const layer = vosLayers.get(id);
    if (layer) {
      map.removeLayer(layer.marker);
      map.removeLayer(layer.circle);
      vosLayers.delete(id);
    }
  });
}

// =====================
// Hoofdstuk: VOS modal (aanmaken/bewerken)
// =====================
function openVosModal(lat, lng, existing) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  const box = document.createElement("div");
  box.className = "modal-box";
  box.innerHTML = `
    <h3 style="margin:0 0 12px 0; font-weight:600;">${
      existing ? "Edit vos" : "Nieuwe vos"
    }</h3>
    <div class="form-grid">
      <label style="font-size:12px;color:#555;">Label (optioneel)
        <input id="vos-label" type="text" value="${
          existing?.label || ""
        }" class="input">
      </label>
      <label style="font-size:12px;color:#555;">Deelgebied
        <select id="vos-area" class="select">
          ${[
            "Alpha",
            "Bravo",
            "Charlie",
            "Delta",
            "Echo",
            "Foxtrot",
            "Golf",
            "Hotel",
            "Oscar",
          ]
            .map(
              (a) =>
                `<option ${
                  existing?.area === a ? "selected" : ""
                }>${a}</option>`
            )
            .join("")}
        </select>
      </label>
      <div class="grid-1">
        <label style="font-size:12px;color:#555;">Datum <input id="vos-date" type="date" class="input"></label>
      </div>
      <div class="grid-1">
        <label style="font-size:12px;color:#555;">Tijd (24h) <input id="vos-time" type="time" step="60" inputmode="numeric" class="input"></label>
      </div>
      <div class="modal-actions">
        <button id="vos-delete" class="btn btn-danger" style="display:${
          existing ? "inline-flex" : "none"
        }">Verwijder</button>
        <div style="display:flex; gap:8px; margin-left:auto;">
          <button id="vos-cancel" class="btn btn-outline">Cancel</button>
          <button id="vos-save" class="btn btn-primary">${
            existing ? "Opslaan" : "Aanmaken"
          }</button>
        </div>
      </div>
    </div>`;
  wrap.appendChild(box);
  document.body.appendChild(wrap);

  const pad = (n) => String(n).padStart(2, "0");
  const toLocalParts = (d) => {
    const t = new Date(d);
    return {
      date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
      time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
    };
  };
  const combineLocalToISO = (dateStr, timeStr) => {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, m] = timeStr.split(":").map(Number);
    const t = new Date();
    t.setFullYear(Y);
    t.setMonth(M - 1);
    t.setDate(D);
    t.setHours(h, m || 0, 0, 0);
    return t.toISOString();
  };

  const dateEl = box.querySelector("#vos-date");
  const timeEl = box.querySelector("#vos-time");
  const { date, time } = existing?.startedAt
    ? toLocalParts(existing.startedAt)
    : toLocalParts(Date.now());
  dateEl.value = date;
  timeEl.value = time;

  const stopWheel = (ev) => ev.preventDefault();
  timeEl.addEventListener("wheel", stopWheel, { passive: false });
  dateEl.addEventListener("wheel", stopWheel, { passive: false });
  timeEl.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
  });

  box.querySelector("#vos-cancel").onclick = () =>
    document.body.removeChild(wrap);

  box.querySelector("#vos-delete").onclick = () => {
    if (!existing) return;
    if (!confirm("Zeker weten verwijderen?")) return;
    const entry = vosLayers.get(existing.id);
    if (entry) {
      map.removeLayer(entry.marker);
      map.removeLayer(entry.circle);
      vosLayers.delete(existing.id);
    }
    window.SocketAPI?.removeVos?.(existing.id);
    document.body.removeChild(wrap);
  };

  box.querySelector("#vos-save").onclick = () => {
    const area = box.querySelector("#vos-area").value;
    const label = box.querySelector("#vos-label").value.trim();
    const startedAt = combineLocalToISO(dateEl.value, timeEl.value);

    if (existing) {
      const updated = { ...existing, area, label, startedAt };
      upsertVosOnMap(updated);
      window.SocketAPI?.updateVos?.(updated);
    } else {
      const id =
        self.crypto?.randomUUID?.() ||
        "vos-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const vos = { id, lat, lng, area, label, startedAt };
      upsertVosOnMap(vos);
      window.SocketAPI?.createVos?.(vos);
    }
    document.body.removeChild(wrap);
  };
}

// =====================
// Hoofdstuk: Document‑brede click‑delegatie (visited/vos knoppen)
// =====================

document.addEventListener("click", (e) => {
  const visitBtn = e.target.closest(".visit-btn");
  if (visitBtn) {
    const id = visitBtn.getAttribute("data-id");
    const next = !(visitBtn.getAttribute("data-visited") === "true");
    visitedState.set(id, next);
    markerById.get(id) && applyVisitedStyle(markerById.get(id), next);
    visitBtn.setAttribute("data-visited", next ? "true" : "false");
    visitBtn.textContent = next ? "Visited \u2713" : "Visited";

    if (window.SocketAPI?.setVisited) {
      window.SocketAPI.setVisited(id, next);
    } else {
      fetch("/api/visited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visited: next }),
      }).catch(() => {});
    }
    return; // early exit
  }

  const removeBtn = e.target.closest(".vos-remove");
  if (removeBtn) {
    const id = removeBtn.getAttribute("data-id");
    if (!id || !confirm("Weet je zeker dat je deze vos wilt verwijderen?"))
      return;
    const entry = vosLayers.get(id);
    if (entry) {
      map.removeLayer(entry.marker);
      map.removeLayer(entry.circle);
      vosLayers.delete(id);
    }
    window.SocketAPI?.removeVos?.(id);
    return;
  }

  const editBtn = e.target.closest(".vos-edit");
  if (editBtn) {
    const id = editBtn.getAttribute("data-id");
    const entry = vosLayers.get(id);
    if (!entry) return;
    openVosModal(entry.data.lat, entry.data.lng, { ...entry.data });
  }
});

// =====================
// Hoofdstuk: Socket listeners (kaart‑relevant)
// =====================
(() => {
  if (!window.SocketAPI?.socket) return;
  const s = window.SocketAPI.socket;
  const myId = window.SocketAPI.getClientId();

  s.on("visited:snapshot", (obj) => {
    if (!obj || typeof obj !== "object") return;
    Object.entries(obj).forEach(([id, val]) => {
      const visited = !!(val && val.visited);
      visitedState.set(id, visited);
      const m = markerById.get(id);
      if (m) applyVisitedStyle(m, visited);
    });
  });

  s.on("visited:update", ({ id, visited }) => {
    if (!id) return;
    visitedState.set(id, !!visited);
    const m = markerById.get(id);
    if (m) applyVisitedStyle(m, !!visited);
  });

  s.on("peers:snapshot", (all) => {
    Object.entries(all || {}).forEach(([id, peer]) => {
      if (id === myId) return;
      if (typeof peer.lat === "number" && typeof peer.lng === "number") {
        upsertPeerMarker(id, peer.name, [peer.lat, peer.lng]);
      }
    });
  });

  s.on("peer:update", ({ clientId, name, lat, lng }) => {
    if (clientId === myId) return;
    if (typeof lat === "number" && typeof lng === "number") {
      upsertPeerMarker(clientId, name, [lat, lng]);
    }
  });

  s.on("peer:leave", ({ clientId }) => {
    const m = peerMarkers.get(clientId);
    if (m) {
      map.removeLayer(m);
      peerMarkers.delete(clientId);
    }
  });

  s.on("draggable:snapshot", ({ lat, lng }) => {
    if (typeof lat === "number" && typeof lng === "number")
      setOrCreateDraggable(lat, lng);
  });
  s.on("draggable:update", ({ lat, lng }) => {
    if (typeof lat === "number" && typeof lng === "number")
      setOrCreateDraggable(lat, lng);
  });

  s.on("vos:snapshot", (obj) => {
    if (!obj) return;
    Object.values(obj).forEach((v) => upsertVosOnMap(v));
  });
  s.on("vos:upsert", (v) => {
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return;
    upsertVosOnMap(v);
  });
  s.on("vos:remove", ({ id }) => {
    const e = vosLayers.get(id);
    if (!e) return;
    map.removeLayer(e.marker);
    map.removeLayer(e.circle);
    vosLayers.delete(id);
  });
})();
