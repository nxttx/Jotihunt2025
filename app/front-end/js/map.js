// create leaflet map
const map = L.map('map').setView([51.988488, 5.896824], 8);
var myLocationMarker;


initMap();
initLocation();
loadMarkers();


function initMap() {
    // add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function initLocation() {
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    setInterval(() => {
        map.locate();
        // instead of using watch, we call locate every 60 seconds. Because now we can reuse the found location
        if (myLocationMarker) {
            var latlon = myLocationMarker.getLatLng();
            // todo send to server as user
        }
    }, 60000);
}

async function loadMarkers() {
    let request = await fetch('/assets/deelnemers.json');
    let data = await request.json();
    data.forEach(location => {
        switch (location.deelgebied) {
            case 'Alpha':
                createLocationMarker(location.lat, location.lon, MarkerAlpha, location.naam, location.locatie);
                break;
            case 'Bravo':
                createLocationMarker(location.lat, location.lon, MarkerBravo, location.naam, location.locatie);
                break;
            case 'Charlie':
                createLocationMarker(location.lat, location.lon, MarkerCharlie, location.naam, location.locatie);
                break;
            case 'Delta':
                createLocationMarker(location.lat, location.lon, MarkerDelta, location.naam, location.locatie);
                break;
            case 'Echo':
                createLocationMarker(location.lat, location.lon, MarkerEcho, location.naam, location.locatie);
                break;
            case 'Foxtrot':
                createLocationMarker(location.lat, location.lon, MarkerFoxtrot, location.naam, location.locatie);
                break;
            case 'Golf':
                createLocationMarker(location.lat, location.lon, MarkerGolf, location.naam, location.locatie);
                break;
            case 'Hotel':
                createLocationMarker(location.lat, location.lon, MarkerHotel, location.naam, location.locatie);
                break;
        }
    });
}






function onLocationFound(e) {
    if (myLocationMarker) {
        map.removeLayer(myLocationMarker);
    }
    myLocationMarker = L.marker(e.latlng, { icon: currentLocationMarker }).addTo(map);
}

function onLocationError(e) {
    alert(e.message);
}

function createLocationMarker(lat, lon, icon, naam, locatie) {
    L.marker([lat, lon], { icon: icon }).addTo(map).on('click', () => {
        L.popup()
            .setLatLng([lat, lon])
            .setContent(`<b>${naam}</b><br>(${locatie}, <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank">Google Maps</a>)`)
            .openOn(map);
    });
}

const currentLocationMarker = L.icon({
    iconUrl: '/images/currentlocation.svg',
    iconSize: [32, 32], // size of the icon
    iconAnchor: [16, 32], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -32] // point from which the popup should open relative to the iconAnchor
});

const MarkerAlpha = L.icon({ iconUrl: '/images/marker_blue.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerBravo = L.icon({ iconUrl: '/images/marker_red.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerCharlie = L.icon({ iconUrl: '/images/marker_yellow.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerDelta = L.icon({ iconUrl: '/images/marker_green.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerEcho = L.icon({ iconUrl: '/images/marker_purple.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerFoxtrot = L.icon({ iconUrl: '/images/marker_pink.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerGolf = L.icon({ iconUrl: '/images/marker_orange.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

const MarkerHotel = L.icon({ iconUrl: '/images/marker_grey.png', iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });