// create leaflet map
const map = L.map("map").setView([51.988488, 5.896824], 8);
var myLocationMarker;
var draggableMarker;

const VOS_SPEED_KMPH = 6;
const VOS_SPEED_MPS = VOS_SPEED_KMPH * (1000 / 3600);

function radiusFromStart(startedAtISO) {
  const t0 = Date.parse(startedAtISO); // NaN-safe
  if (!Number.isFinite(t0)) return 0;

  const dtSec = Math.max(0, (Date.now() - t0) / 1000); // nooit negatief
  return dtSec * VOS_SPEED_MPS; // meters
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

const vosLayers = new Map();
const markerById = new Map();
const visitedState = new Map();
const peerMarkers = new Map();

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

function markerId(lat, lon) {
  return `${lat},${lon}`;
}

function applyVisitedStyle(marker, visited) {
  marker.setOpacity(visited ? 0.5 : 1);
}

initMap();
initLocation();
loadMarkers();
loadDraggableMarker();

function initMap() {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  if (window.SocketAPI) {
    SocketAPI.connect();

    if (window.SocketAPI && typeof SocketAPI.updateDraggable !== "function") {
      SocketAPI.updateDraggable = function (lat, lng) {
        if (SocketAPI.socket?.connected) {
          SocketAPI.socket.emit("draggable:update", { lat, lng });
        }
      };
    }

    document
      .getElementById("name-input")
      ?.addEventListener("blur", function (e) {
        SocketAPI.updateName(e.target.value);
      });
  }

  map.on("click", (e) => {
    openVosModal(e.latlng.lat, e.latlng.lng);
  });
}

function initLocation() {
  map.on("locationfound", onLocationFound);
  map.on("locationerror", onLocationError);

  map.locate({ enableHighAccuracy: true });

  setInterval(() => {
    map.locate({ enableHighAccuracy: true });
    if (myLocationMarker) {
      var latlon = myLocationMarker.getLatLng();
      if (window.SocketAPI) {
        SocketAPI.sendLocation(latlon.lat, latlon.lng);
      }
    }

    vosLayers.forEach(({ circle, data }) => {
      const r = radiusFromStart(data.startedAt);
      circle.setRadius(r);
    });
  }, 5000);
}

async function loadMarkers() {
  let request = await fetch("https://jotihunt.nl/api/2.0/subscriptions");
  let data = await request.json();
  data.data.forEach((location) => {
    switch (location.area) {
      case "Alpha":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerAlpha,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Bravo":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerBravo,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Charlie":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerCharlie,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Delta":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerDelta,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Echo":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerEcho,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Foxtrot":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerFoxtrot,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Golf":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerGolf,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Hotel":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerHotel,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
      case "Oscar":
        createLocationMarker(
          location.lat,
          location.long,
          MarkerOscar,
          location.name,
          `${location.street} ${location.housenumber} ${location.housenumber_addition}, ${location.city}, ${location.postcode}`,
          location.area
        );
        break;
    }
  });
}

function onLocationFound(e) {
  if (myLocationMarker) {
    map.removeLayer(myLocationMarker);
  }
  myLocationMarker = L.marker(e.latlng, { icon: currentLocationMarker }).addTo(
    map
  );
  if (window.SocketAPI) {
    SocketAPI.sendLocation(e.latlng.lat, e.latlng.lng, e.accuracy);
  }
}

function onLocationError(e) {
  alert(e.message);
}

async function loadDraggableMarker() {
  let request = await fetch("/api/draggablemarker/location");
  let data = await request.json();
  const lat = data.lat;
  const lng = data.lng;

  setOrCreateDraggable(lat, lng);
}

function setOrCreateDraggable(lat, lng) {
  if (!draggableMarker) {
    draggableMarker = L.marker([lat, lng], {
      icon: pin,
      draggable: true,
    }).addTo(map);

    draggableMarker.on("dragend", function (e) {
      const p = e.target.getLatLng();
      if (window.SocketAPI && typeof SocketAPI.updateDraggable === "function") {
        SocketAPI.updateDraggable(p.lat, p.lng);
      }
    });

    draggableMarker.on("click", function (e) {
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

function createLocationMarker(lat, lon, icon, naam, locatie, area) {
  if (area === "Undefined") area = "Marker";

  const id = markerId(lat, lon);
  const m = L.marker([lat, lon], { icon }).addTo(map);

  // onthoud marker
  markerById.set(id, m);

  // initial style
  applyVisitedStyle(m, visitedState.get(id) === true);

  // popup on click (bouwt content dynamisch, zodat label klopt)
  m.on("click", () => {
    const v = visitedState.get(id) === true;
    const btnLabel = v ? "Visited ✓" : "Visited";
    const btnAria = v ? "Mark as not visited" : "Mark as visited";

    const html = `
      <b>${naam}</b> - <b>${area}</b><br />
      (${locatie}, <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener">Google Maps</a>)
      <div style="margin-top:8px;">
        <button class="visit-btn"
                data-id="${id}"
                data-visited="${v ? "true" : "false"}"
                style="padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.12);background:#fff;cursor:pointer;">
          ${btnLabel}
        </button>
      </div>
    `;

    L.popup().setLatLng([lat, lon]).setContent(html).openOn(map);
  });

  return m;
}

const currentLocationMarker = L.icon({
  iconUrl: "/images/currentlocation.svg",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -32],
});

const pin = L.icon({
  iconUrl: "/images/pin.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const MarkerAlpha = L.icon({
  iconUrl: "/images/marker_blue.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerBravo = L.icon({
  iconUrl: "/images/marker_red.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerCharlie = L.icon({
  iconUrl: "/images/marker_yellow.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerDelta = L.icon({
  iconUrl: "/images/marker_green.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerEcho = L.icon({
  iconUrl: "/images/marker_purple.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerFoxtrot = L.icon({
  iconUrl: "/images/marker_pink.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerGolf = L.icon({
  iconUrl: "/images/marker_orange.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerHotel = L.icon({
  iconUrl: "/images/marker_grey.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const MarkerOscar = L.icon({
  iconUrl: "/images/marker_white.png",
  iconSize: [22, 40],
  iconAnchor: [11, 40],
  popupAnchor: [0, -40],
});

const AREA_COLORS = {
  Alpha: "#00a8ff", // blauw
  Bravo: "#e84118", // rood
  Charlie: "#e1b12c", // geel
  Delta: "#4cd137", // groen
  Echo: "#8c7ae6", // paars
  Foxtrot: "#ff6b81", // roze
  Golf: "#e1902c", // oranje
  Hotel: "#7f8fa6", // grijs
  Oscar: "#f5f6fa", // wit (rand donker maken)
};

const AREA_ICONS = {
  Alpha: MarkerAlpha,
  Bravo: MarkerBravo,
  Charlie: MarkerCharlie,
  Delta: MarkerDelta,
  Echo: MarkerEcho,
  Foxtrot: MarkerFoxtrot,
  Golf: MarkerGolf,
  Hotel: MarkerHotel,
  Oscar: MarkerOscar,
};

function areaColor(area) {
  return (AREA_COLORS && AREA_COLORS[area]) || "#111";
}

function areaIcon(area) {
  return (AREA_ICONS && AREA_ICONS[area]) || pin;
}

if (window.SocketAPI) {
  const s = SocketAPI.socket;
  const myId = SocketAPI.getClientId();

  s.on("visited:snapshot", (obj) => {
    if (obj && typeof obj === "object") {
      Object.entries(obj).forEach(([id, val]) => {
        const visited = !!(val && val.visited);
        visitedState.set(id, visited);
        const m = markerById.get(id);
        if (m) applyVisitedStyle(m, visited);
      });
    }
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
    if (typeof lat !== "number" || typeof lng !== "number") return;
    setOrCreateDraggable(lat, lng); // <-- nieuw
  });

  s.on("draggable:update", ({ lat, lng }) => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    setOrCreateDraggable(lat, lng); // <-- nieuw
  });

  s.on("vos:snapshot", (obj) => {
    // obj = { id: {id,lat,lng,area,startedAt,label?}, ... }
    if (!obj) return;
    Object.values(obj).forEach((v) => upsertVosOnMap(v));
  });

  s.on("vos:upsert", (v) => {
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return;
    upsertVosOnMap(v);
  });

  s.on("vos:remove", ({ id }) => {
    const entry = vosLayers.get(id);
    if (!entry) return;
    map.removeLayer(entry.marker);
    map.removeLayer(entry.circle);
    vosLayers.delete(id);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".visit-btn");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  const current = btn.getAttribute("data-visited") === "true";
  const next = !current;

  visitedState.set(id, next);
  const marker = markerById.get(id);
  if (marker) applyVisitedStyle(marker, next);

  btn.setAttribute("data-visited", next ? "true" : "false");
  btn.textContent = next ? "Visited ✓" : "Visited";

  if (window.SocketAPI && typeof SocketAPI.setVisited === "function") {
    SocketAPI.setVisited(id, next);
  } else {
    fetch("/api/visited", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visited: next }),
    }).catch(() => {});
  }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".vos-remove");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (!id) return;

  if (!confirm("Weet je zeker dat je deze vos wilt verwijderen?")) return;

  // lokaal weghalen
  const entry = vosLayers.get(id);
  if (entry) {
    map.removeLayer(entry.marker);
    map.removeLayer(entry.circle);
    vosLayers.delete(id);
  }
  // server laten weten
  if (window.SocketAPI) SocketAPI.removeVos(id);
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".vos-edit");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const entry = vosLayers.get(id);
  if (!entry) return;
  openVosModal(entry.data.lat, entry.data.lng, { ...entry.data });
});

function upsertVosOnMap(v) {
  const id = v.id;
  const pos = [v.lat, v.lng];
  const color = areaColor(v.area);
  const icon = areaIcon(v.area);

  let entry = vosLayers.get(id);
  if (!entry) {
    const marker = L.marker(pos, { icon }).addTo(map);

    const onClick = () => {
      // trek actuele data uit de map (niet uit closure!)
      const cur = vosLayers.get(id)?.data || v;
      const r = radiusFromStart(cur.startedAt);
      const startLocal = new Date(cur.startedAt).toLocaleString();

      const html = `
        <b>Vos</b> ${cur.label ? `— ${cur.label}` : ""}<br/>
        <b>Area:</b> ${cur.area}<br/>
        <b>Gestart:</b> ${startLocal}<br/>
        <b>Radius:</b> ~${Math.round(r)} m<br/>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="vos-edit" data-id="${id}">Edit</button>
          <button class="vos-remove" data-id="${id}" style="background:#e84118;color:#fff;border:1px solid #e84118;padding:6px 10px;border-radius:8px;cursor:pointer;">Verwijder</button>
          <a href="https://www.google.com/maps/search/?api=1&query=${cur.lat},${
        cur.lng
      }" target="_blank" rel="noopener">Google Maps</a>
        </div>
      `;
      L.popup().setLatLng([cur.lat, cur.lng]).setContent(html).openOn(map);
    };

    marker.on("click", onClick);

    const circle = L.circle(pos, {
      radius: radiusFromStart(v.startedAt),
      color: v.area === "Oscar" ? "#333" : color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.15,
    }).addTo(map);

    vosLayers.set(id, { marker, circle, data: { ...v } });
  } else {
    // data bijwerken
    entry.data = { ...entry.data, ...v };

    // positie + stijl
    entry.marker.setLatLng(pos);
    entry.marker.setIcon(icon);

    const color2 = areaColor(entry.data.area);
    entry.circle.setLatLng(pos);
    entry.circle.setStyle({
      color: entry.data.area === "Oscar" ? "#333" : color2,
      fillColor: color2,
    });

    // radius direct bijwerken (niet wachten op interval)
    entry.circle.setRadius(radiusFromStart(entry.data.startedAt));
  }
}

function openVosModal(lat, lng, existing) {
  // overlay
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    display:flex; align-items:center; justify-content:center; z-index:10000;
    padding:16px;
  `;
  // dialog
  const box = document.createElement("div");
  box.style.cssText = `
    background:#fff; border-radius:16px; padding:16px; width:min(420px, 100%);
    box-shadow:0 12px 36px rgba(0,0,0,.25); font-family:Inter,system-ui,sans-serif;
  `;
  box.innerHTML = `
    <h3 style="margin:0 0 12px 0; font-weight:600;">${
      existing ? "Edit vos" : "Nieuwe vos"
    }</h3>
    <div style="display:grid; gap:10px;">
      <label style="font-size:12px;color:#555;">Label (optioneel)
        <input id="vos-label" type="text" value="${existing?.label || ""}"
               style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
      </label>

      <label style="font-size:12px;color:#555;">Deelgebied
        <select id="vos-area" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
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

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <label style="font-size:12px;color:#555;">Datum
          <input id="vos-date" type="date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
        </label>
        <label style="font-size:12px;color:#555;">Tijd (24h)
          <input id="vos-time" type="time" step="60" inputmode="numeric"
                 style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
        </label>
      </div>

      <div style="display:flex; gap:8px; justify-content:space-between; margin-top:6px;">
        <button id="vos-delete" style="display:${
          existing ? "inline-flex" : "none"
        };padding:10px 12px;border-radius:10px;border:1px solid #e84118;background:#e84118;color:#fff;cursor:pointer;">Verwijder</button>
        <div style="display:flex; gap:8px; margin-left:auto;">
          <button id="vos-cancel" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;background:#fff;cursor:pointer;">Cancel</button>
          <button id="vos-save" style="padding:10px 12px;border-radius:10px;border:1px solid #0a7;background:#0a7;color:#fff;cursor:pointer;">
            ${existing ? "Opslaan" : "Aanmaken"}
          </button>
        </div>
      </div>
    </div>
  `;
  wrap.appendChild(box);
  document.body.appendChild(wrap);

  // helpers voor tijd
  const pad = (n) => String(n).padStart(2, "0");
  const toLocalParts = (d) => {
    const t = new Date(d);
    return {
      date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
      time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
    };
  };
  const combineLocalToISO = (dateStr, timeStr) => {
    // veilig combineren (lokale tijd → ISO)
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, m] = timeStr.split(":").map(Number);
    const t = new Date();
    t.setFullYear(Y);
    t.setMonth(M - 1);
    t.setDate(D);
    t.setHours(h, m || 0, 0, 0);
    return t.toISOString();
  };

  // prefills
  const dateEl = box.querySelector("#vos-date");
  const timeEl = box.querySelector("#vos-time");
  const { date, time } = existing?.startedAt
    ? toLocalParts(existing.startedAt)
    : toLocalParts(Date.now());
  dateEl.value = date;
  timeEl.value = time;

  // scroll-wiel uitschakelen op time-input
  const stopWheel = (ev) => ev.preventDefault();
  timeEl.addEventListener("wheel", stopWheel, { passive: false });
  dateEl.addEventListener("wheel", stopWheel, { passive: false });
  // ook arrow-keys optioneel blokkeren (voorkomt "scrollen" via toetsen)
  timeEl.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
  });

  box.querySelector("#vos-cancel").onclick = () =>
    document.body.removeChild(wrap);

  box.querySelector("#vos-delete").onclick = () => {
    if (!existing) return;
    if (!confirm("Zeker weten verwijderen?")) return;
    // lokaal
    const entry = vosLayers.get(existing.id);
    if (entry) {
      map.removeLayer(entry.marker);
      map.removeLayer(entry.circle);
      vosLayers.delete(existing.id);
    }
    // server
    if (window.SocketAPI) SocketAPI.removeVos(existing.id);
    document.body.removeChild(wrap);
  };

  box.querySelector("#vos-save").onclick = () => {
    const area = box.querySelector("#vos-area").value;
    const label = box.querySelector("#vos-label").value.trim();
    const startedAt = combineLocalToISO(dateEl.value, timeEl.value);

    if (existing) {
      const updated = { ...existing, area, label, startedAt };
      upsertVosOnMap(updated); // UI direct updaten
      if (window.SocketAPI) SocketAPI.updateVos(updated); // sync
    } else {
      const id =
        self.crypto?.randomUUID?.() ||
        "vos-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const vos = { id, lat, lng, area, label, startedAt };
      upsertVosOnMap(vos); // optimistisch tekenen
      if (window.SocketAPI) SocketAPI.createVos(vos); // sync
    }
    document.body.removeChild(wrap);
  };
}
