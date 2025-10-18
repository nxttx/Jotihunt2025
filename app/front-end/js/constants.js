// =====================
// Hoofdstuk: Iconen & Kleuren
// =====================
(() => {
  const icon22 = (url) => L.icon({ iconUrl: url, iconSize: [22, 40], iconAnchor: [11, 40], popupAnchor: [0, -40] });

  const Icons = {
    Alpha:  icon22('/images/marker_blue.png'),
    Bravo:  icon22('/images/marker_red.png'),
    Charlie:icon22('/images/marker_yellow.png'),
    Delta:  icon22('/images/marker_green.png'),
    Echo:   icon22('/images/marker_purple.png'),
    Foxtrot:icon22('/images/marker_pink.png'),
    Golf:   icon22('/images/marker_orange.png'),
    Hotel:  icon22('/images/marker_grey.png'),
    Oscar:  icon22('/images/marker_white.png'),
    Pin:    L.icon({ iconUrl: '/images/pin.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }),
    Current:L.icon({ iconUrl: '/images/currentlocation.svg', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -32] })
  };

  const AreaColors = {
    Alpha:   '#00a8ff', // blauw
    Bravo:   '#e84118', // rood
    Charlie: '#e1b12c', // geel
    Delta:   '#4cd137', // groen
    Echo:    '#8c7ae6', // paars
    Foxtrot: '#ff6b81', // roze
    Golf:    '#e1902c', // oranje
    Hotel:   '#7f8fa6', // grijs
    Oscar:   '#f5f6fa', // wit
  };

  function areaColor(area) { return AreaColors[area] || '#111'; }
  function areaIcon(area)  { return Icons[area] || Icons.Pin; }

  window.App = window.App || {};
  Object.assign(window.App, { Icons, AreaColors, areaColor, areaIcon });
})();