// =====================
// Hoofdstuk: Basis kaart
// =====================
const map = L.map("map").setView([51.988488, 5.896824], 8);
let myLocationMarker;
let draggableMarker;

// =====================
// Routing (client-side) – LRM lazy loader + helpers
// =====================
let LRM_READY = false;
let routingControl = null;
let routeEtaPopup = null; // kleine ETA-popup op bestemming

function injectOnce(id, tag, attrs = {}, inner = "") {
  if (document.getElementById(id)) return;
  const el = document.createElement(tag);
  el.id = id;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (inner) el.textContent = inner;
  document.head.appendChild(el);
}

function ensureRoutingLoaded() {
  if (LRM_READY || (window.L && L.Routing)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // LRM CSS
    injectOnce("lrm-css", "link", {
      rel: "stylesheet",
      href: "https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css",
    });
    // Extra CSS: verberg paneel + style Cancel-knop
    injectOnce(
      "route-ui-css",
      "style",
      {},
      `
      .leaflet-routing-container { display: none !important; }
      .route-cancel-bar {
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: calc(var(--panel-z, 9999) + 1);
        display: none;
      }
      .route-cancel-bar .btn {
        padding: 10px 14px;
        border-radius: 12px;
        font: 600 14px/1 Inter, system-ui, sans-serif;
        box-shadow: 0 6px 18px rgba(0,0,0,0.15);
      }
      @media (max-width: 640px) {
        .route-cancel-bar { top: 8px; }
        .route-cancel-bar .btn { padding: 12px 16px; font-size: 15px; }
      }
      `
    );
    // LRM script
    if (!document.getElementById("lrm-js")) {
      const s = document.createElement("script");
      s.id = "lrm-js";
      s.src =
        "https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js";
      s.onload = () => {
        LRM_READY = true;
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    } else {
      const check = () =>
        window.L && L.Routing ? resolve() : setTimeout(check, 50);
      check();
    }
  });
}

function ensureRouteCancelUI() {
  if (document.getElementById("route-cancel-bar")) return;
  const bar = document.createElement("div");
  bar.id = "route-cancel-bar";
  bar.className = "route-cancel-bar";
  bar.innerHTML = `
    <button id="route-cancel-btn" class="btn btn-danger">Cancel route</button>
  `;
  document.body.appendChild(bar);
  document.getElementById("route-cancel-btn").addEventListener("click", () => {
    destroyRoute();
  });
}
function showRouteCancelUI() {
  ensureRouteCancelUI();
  const el = document.getElementById("route-cancel-bar");
  if (el) el.style.display = "block";
}
function hideRouteCancelUI() {
  const el = document.getElementById("route-cancel-bar");
  if (el) el.style.display = "none";
}

function destroyRoute() {
  if (routingControl) {
    try {
      map.removeControl(routingControl);
    } catch {}
    routingControl = null;
  }
  if (routeEtaPopup) {
    try {
      map.closePopup(routeEtaPopup);
    } catch {}
    routeEtaPopup = null;
  }
  hideRouteCancelUI();
}

function formatDurationSecs(secs) {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}u ${r}m` : `${h}u`;
}

async function startRoute(fromLL, toLL, onETA) {
  try {
    await ensureRoutingLoaded();
  } catch (e) {
    alert("Routing-libs konden niet laden.");
    return;
  }
  destroyRoute(); // eerst vorige route weg
  showRouteCancelUI();

  routingControl = L.Routing.control({
    waypoints: [L.latLng(fromLL.lat, fromLL.lng), L.latLng(toLL.lat, toLL.lng)],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      profile: "driving",
    }),
    addWaypoints: false,
    routeWhileDragging: false,
    draggableWaypoints: false,
    showAlternatives: false,
    lineOptions: { styles: [{ weight: 5, opacity: 0.95 }] },
    createMarker: () => null,
  }).addTo(map);

  routingControl.on("routesfound", (e) => {
    const best = e.routes?.[0];
    if (!best) return;
    const secs = best.summary?.totalTime ?? 0;
    const etaTxt = formatDurationSecs(secs);
    onETA?.(etaTxt);

    // ETA popup op bestemming
    routeEtaPopup = L.popup({ autoPan: true })
      .setLatLng([toLL.lat, toLL.lng])
      .setContent(`<b>Route</b><br>ETA: ~${etaTxt}`)
      .openOn(map);
  });

  routingControl.on("routingerror", () => {
    alert("Route berekenen mislukt.");
    destroyRoute();
  });
}

function routeFromCurrentTo(target, updateBtnEl) {
  if (!myLocationMarker) {
    map.locate({ enableHighAccuracy: true });
    alert("Je locatie is nog niet bekend. Probeer zo opnieuw.");
    return;
  }
  const from = myLocationMarker.getLatLng();
  const to = target;

  if (updateBtnEl) {
    updateBtnEl.textContent = "Route (berekenen...)";
    updateBtnEl.disabled = true;
  }

  startRoute(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
    (etaTxt) => {
      if (updateBtnEl) {
        updateBtnEl.textContent = `Route (~${etaTxt})`;
        updateBtnEl.disabled = false;
      }
    }
  );
}

// =====================
// Hoofdstuk: Snelheden (VOS)
// =====================
const VOS_SPEED_KMPH = 6;
const VOS_SPEED_MPS = VOS_SPEED_KMPH * (1000 / 3600);

// =====================
// Hoofdstuk: Helpers
// =====================
function radiusFromStart(startedAtISO) {
  const t0 = Date.parse(startedAtISO);
  if (!Number.isFinite(t0)) return 0;
  const dtSec = Math.max(0, (Date.now() - t0) / 1000);
  return dtSec * VOS_SPEED_MPS;
}

function markerId(lat, lon) {
  return `${lat},${lon}`;
}

function applyVisitedStyle(marker, visited) {
  marker.setOpacity(visited ? 0.5 : 1);
}

// Server-graph helper
let latestVosGraph = null;
function newestVosIdForArea(area) {
  return latestVosGraph?.areas?.[area]?.newestId ?? null;
}

function closePopupIfVos(id) {
  const p = map && map._popup;
  if (!p) return;
  const c = p.getContent && p.getContent();
  if (!c) return;

  if (typeof c === "string") {
    if (
      c.includes(`class="btn btn-danger  btn-xs vos-remove"`) &&
      c.includes(`data-id="${id}"`)
    ) {
      map.closePopup();
    }
  } else if (c instanceof HTMLElement) {
    const btn = c.querySelector(`.vos-remove[data-id="${id}"]`);
    if (btn) map.closePopup();
  }
}

// =====================
// Hoofdstuk: State
// =====================
const vosLayers = new Map();
const markerById = new Map();
const visitedState = new Map();
const peerMarkers = new Map();

const areaPolylines = new Map();

// =====================
// Hoofdstuk: Init kaart + tilelayer + events
// =====================
(function initMap() {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Klik op de kaart -> popup met acties
  map.on("click", (e) => showMapActionPopup(e.latlng));

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

  // Zorg dat de Cancel-route UI bestaat
  ensureRouteCancelUI();
})();

function showMapActionPopup(latlng) {
  const html = `
    <b>Acties</b><br/>
    <div class="popup-actions">
      <button class="btn btn-outline btn-xs route-here" data-lat="${latlng.lat}" data-lng="${latlng.lng}">Route hierheen</button>
      <button class="btn btn-primary btn-xs vos-create-here" data-lat="${latlng.lat}" data-lng="${latlng.lng}">VOS aanmaken</button>
    </div>
  `;
  L.popup().setLatLng(latlng).setContent(html).openOn(map);
}

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

    // VOS radii bijwerken (alleen bestaande cirkels)
    vosLayers.forEach(({ circle, data }) => {
      if (circle) circle.setRadius(radiusFromStart(data.startedAt));
    });
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
// Hoofdstuk: Subscriptie-markers (Jotihunt API)
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
        <button class="btn btn-outline btn-xs route-to" data-lat="${lat}" data-lng="${lon}">Route (~ETA)</button>
        <button class="btn btn-outline btn-xs visit-btn" data-id="${id}" data-visited="${
      v ? "true" : "false"
    }">${btnLabel}</button>
      </div>
    `;
    L.popup().setLatLng([lat, lon]).setContent(html).openOn(map);
  });
}

// =====================
// Hoofdstuk: Draggable marker (server-gedeelde pin)
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
          `<b>Draggable Marker</b><br>
           <div class="popup-actions">
             <button class="btn btn-outline btn-xs route-to" data-lat="${p.lat}" data-lng="${p.lng}">Route (~ETA)</button>
             <a class="btn btn-outline btn-xs" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Maps</a>
           </div>`
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
  const icon = App.Icons.Vos; // altijd zwart

  let entry = vosLayers.get(id);
  if (!entry) {
    const marker = L.marker(pos, { icon }).addTo(map);

    marker.on("click", () => {
      const cur = vosLayers.get(id)?.data || v;
      const r = radiusFromStart(cur.startedAt);
      const startLocal = new Date(cur.startedAt).toLocaleString();

      const newestId = newestVosIdForArea(cur.area);
      const isNewest = newestId === id;
      const effectiveEnabled = isNewest && cur.circleEnabled !== false;

      const circleBtnHtml = isNewest
        ? `<button class="btn btn-outline btn-xs vos-circle-toggle" data-id="${id}" data-enabled="${
            effectiveEnabled ? "true" : "false"
          }">
             Cirkel: ${effectiveEnabled ? "Aan" : "Uit"}
           </button>`
        : `<button class="btn btn-outline btn-xs" disabled title="Alleen de nieuwste VOS toont een cirkel">Cirkel: Uit</button>`;

      const html = `
        <b>Vos</b> ${cur.label ? `— ${cur.label}` : ""}<br/>
        <b>Area:</b> ${cur.area}<br/>
        <b>Gestart:</b> ${startLocal}<br/>
        <b>Radius:</b> ~${Math.round(r)} m<br/>
        <div class="popup-actions">
          <button class="btn btn-outline btn-xs route-to" data-lat="${
            cur.lat
          }" data-lng="${cur.lng}">Route (~ETA)</button>
          <button class="btn btn-outline btn-xs vos-edit" data-id="${id}">Edit</button>
          <button class="btn btn-danger  btn-xs vos-remove" data-id="${id}">Verwijder</button>
          ${circleBtnHtml}
          <a class="btn btn-outline btn-xs" href="https://www.google.com/maps/search/?api=1&query=${
            cur.lat
          },${cur.lng}" target="_blank" rel="noopener">Google Maps</a>
        </div>`;
      L.popup().setLatLng([cur.lat, cur.lng]).setContent(html).openOn(map);
    });

    vosLayers.set(id, { marker, circle: null, data: { ...v } });
  } else {
    entry.data = { ...entry.data, ...v };
    entry.marker.setLatLng(pos).setIcon(App.Icons.Vos);
  }
}

function removeVos(ids) {
  (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
    const layer = vosLayers.get(id);
    if (layer) {
      map.removeLayer(layer.marker);
      if (layer.circle) map.removeLayer(layer.circle);
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
      <div class="grid-1">
        <label style="font-size:12px;color:#555; display:flex; align-items:center; gap:8px;">
          <input id="vos-circle-enabled" type="checkbox" style="transform:translateY(1px)">
          Afstandscirkel tonen
        </label>
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
  const circleEl = box.querySelector("#vos-circle-enabled");
  const { date, time } = existing?.startedAt
    ? toLocalParts(existing.startedAt)
    : toLocalParts(Date.now());
  dateEl.value = date;
  timeEl.value = time;
  circleEl.checked = existing ? existing.circleEnabled !== false : true;

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
      if (entry.circle) map.removeLayer(entry.circle);
      vosLayers.delete(existing.id);
    }
    closePopupIfVos(existing.id);
    window.SocketAPI?.removeVos?.(existing.id);
    document.body.removeChild(wrap);
  };

  box.querySelector("#vos-save").onclick = () => {
    const area = box.querySelector("#vos-area").value;
    const label = box.querySelector("#vos-label").value.trim();
    const startedAt = combineLocalToISO(dateEl.value, timeEl.value);
    const circleEnabled = !!circleEl.checked;

    if (existing) {
      const updated = { ...existing, area, label, startedAt, circleEnabled };
      upsertVosOnMap(updated);
      window.SocketAPI?.updateVos?.(updated);
    } else {
      const id =
        self.crypto?.randomUUID?.() ||
        "vos-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const vos = { id, lat, lng, area, label, startedAt, circleEnabled };
      upsertVosOnMap(vos);
      window.SocketAPI?.createVos?.(vos);
    }
    document.body.removeChild(wrap);
  };
}

// =====================
// Hoofdstuk: Polyline & cirkel toepassing (server-graph)
// =====================
function removePolyline(area) {
  const pl = areaPolylines.get(area);
  if (pl) {
    map.removeLayer(pl);
    areaPolylines.delete(area);
  }
}

function applyVosGraph(graph) {
  latestVosGraph = graph || null;

  const seenAreas = new Set();

  Object.entries(graph?.areas || {}).forEach(([area, info]) => {
    seenAreas.add(area);
    const color = App.areaColor(area);
    let pl = areaPolylines.get(area);
    if (!pl) {
      pl = L.polyline(info.coords || [], {
        color,
        weight: 3,
        opacity: 0.9,
      }).addTo(map);
      areaPolylines.set(area, pl);
    } else {
      pl.setLatLngs(info.coords || []).setStyle({
        color,
        weight: 3,
        opacity: 0.9,
      });
    }
  });

  Array.from(areaPolylines.keys()).forEach((area) => {
    if (!seenAreas.has(area)) removePolyline(area);
  });

  Object.entries(graph?.areas || {}).forEach(([area, info]) => {
    const newestId = info.newestId;
    (info.order || []).forEach((id) => {
      const entry = vosLayers.get(id);
      if (!entry) return;
      const isNewest = id === newestId;
      const enabledForThisVos = entry.data.circleEnabled !== false;
      const shouldHaveCircle = isNewest && enabledForThisVos;

      if (!shouldHaveCircle) {
        if (entry.circle) {
          map.removeLayer(entry.circle);
          entry.circle = null;
        }
      } else {
        const color = App.areaColor(area);
        if (!entry.circle) {
          entry.circle = L.circle([entry.data.lat, entry.data.lng], {
            radius: radiusFromStart(entry.data.startedAt),
            color: area === "Oscar" ? "#333" : color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
          }).addTo(map);
        } else {
          entry.circle
            .setLatLng([entry.data.lat, entry.data.lng])
            .setStyle({
              color: area === "Oscar" ? "#333" : color,
              fillColor: color,
            })
            .setRadius(radiusFromStart(entry.data.startedAt));
        }
      }
    });
  });
}

// =====================
// Hoofdstuk: Document-brede click-delegatie (visited/vos/route knoppen)
// =====================
document.addEventListener("click", (e) => {
  // Visited toggle
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
    return;
  }

  // VOS verwijderen
  const removeBtn = e.target.closest(".vos-remove");
  if (removeBtn) {
    const id = removeBtn.getAttribute("data-id");
    if (!id || !confirm("Weet je zeker dat je deze vos wilt verwijderen?"))
      return;

    const entry = vosLayers.get(id);
    if (entry) {
      map.removeLayer(entry.marker);
      if (entry.circle) map.removeLayer(entry.circle);
      vosLayers.delete(id);
    }

    closePopupIfVos(id);
    window.SocketAPI?.removeVos?.(id);
    return;
  }

  // VOS edit
  const editBtn = e.target.closest(".vos-edit");
  if (editBtn) {
    const id = editBtn.getAttribute("data-id");
    const entry = vosLayers.get(id);
    if (!entry) return;
    openVosModal(entry.data.lat, entry.data.lng, { ...entry.data });
    return;
  }

  // Cirkel toggle (alleen nieuwste)
  const circleBtn = e.target.closest(".vos-circle-toggle");
  if (circleBtn) {
    if (circleBtn.hasAttribute("disabled")) return;
    const id = circleBtn.getAttribute("data-id");
    const entry = vosLayers.get(id);
    if (!entry) return;

    const newestId = newestVosIdForArea(entry.data.area);
    if (entry.data.id !== newestId) return;

    const current = entry.data.circleEnabled !== false;
    const next = !current;

    entry.data.circleEnabled = next;
    circleBtn.setAttribute("data-enabled", next ? "true" : "false");
    circleBtn.textContent = `Cirkel: ${next ? "Aan" : "Uit"}`;

    window.SocketAPI?.updateVos?.({ id, circleEnabled: next });
    return;
  }

  // Route-knoppen (popups bij markers & draggable)
  const routeToBtn = e.target.closest(".route-to");
  if (routeToBtn) {
    const lat = parseFloat(routeToBtn.getAttribute("data-lat"));
    const lng = parseFloat(routeToBtn.getAttribute("data-lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    routeFromCurrentTo({ lat, lng }, routeToBtn);
    return;
  }

  // Klik op kaart -> "Route hierheen"
  const routeHereBtn = e.target.closest(".route-here");
  if (routeHereBtn) {
    const lat = parseFloat(routeHereBtn.getAttribute("data-lat"));
    const lng = parseFloat(routeHereBtn.getAttribute("data-lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    routeFromCurrentTo({ lat, lng }, routeHereBtn);
    return;
  }

  // Klik op kaart -> "VOS aanmaken"
  const vosCreateBtn = e.target.closest(".vos-create-here");
  if (vosCreateBtn) {
    const lat = parseFloat(vosCreateBtn.getAttribute("data-lat"));
    const lng = parseFloat(vosCreateBtn.getAttribute("data-lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    openVosModal(lat, lng);
    return;
  }
});

// =====================
// Hoofdstuk: Socket listeners (kaart-relevant)
// =====================
(() => {
  if (!window.SocketAPI?.socket) return;
  const s = window.SocketAPI.socket;
  const myId = window.SocketAPI.getClientId();

  // visited
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

  // peers
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

  // draggable
  s.on("draggable:snapshot", ({ lat, lng }) => {
    if (typeof lat === "number" && typeof lng === "number")
      setOrCreateDraggable(lat, lng);
  });
  s.on("draggable:update", ({ lat, lng }) => {
    if (typeof lat === "number" && typeof lng === "number")
      setOrCreateDraggable(lat, lng);
  });

  // vos
  s.on("vos:snapshot", (obj) => {
    const serverIds = new Set(Object.keys(obj || {}));

    Array.from(vosLayers.keys()).forEach((id) => {
      if (!serverIds.has(id)) {
        const e = vosLayers.get(id);
        if (e) {
          map.removeLayer(e.marker);
          if (e.circle) map.removeLayer(e.circle);
        }
        vosLayers.delete(id);
      }
    });

    Object.values(obj || {}).forEach((v) => upsertVosOnMap(v));
  });

  s.on("vos:upsert", (v) => {
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return;
    upsertVosOnMap(v);
  });

  s.on("vos:remove", ({ id }) => {
    const e = vosLayers.get(id);
    if (e) {
      map.removeLayer(e.marker);
      if (e.circle) map.removeLayer(e.circle);
      vosLayers.delete(id);
    }
    closePopupIfVos(id);
  });

  s.on("vos:graph", (graph) => {
    applyVosGraph(graph);
  });
})();
