// create leaflet map
const map = L.map("map").setView([51.988488, 5.896824], 8);
var myLocationMarker;
var draggableMarker;

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
  } else {
    draggableMarker.setLatLng([lat, lng]);
  }
}

function createLocationMarker(lat, lon, icon, naam, locatie, area) {
  if (area === "Undefined") area = "Marker";

  return L.marker([lat, lon], { icon: icon })
    .addTo(map)
    .on("click", () => {
      L.popup()
        .setLatLng([lat, lon])
        .setContent(
          `<b>${naam}</b> - <b>${area}</b> <br> (${locatie}, <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank">Google Maps</a>)`
        )
        .openOn(map);
    });
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

if (window.SocketAPI) {
  const s = SocketAPI.socket;
  const myId = SocketAPI.getClientId();

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
}
