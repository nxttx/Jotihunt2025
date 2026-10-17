// =====================
// Hoofdstuk: Area statusbalk
// =====================
(function initAreas() {
  retrieveAreas();
  setInterval(retrieveAreas, 60 * 1000);
})();

async function retrieveAreas() {
  try {
    const request = await fetch("https://jotihunt.nl/api/2.0/areas");
    const response = await request.json();
    const root = document.querySelector(".areas");
    if (!root) return;
    root.innerHTML = "";

    (response.data || []).forEach((area) => {
      let classname = "huntable_card " + area.status;
      switch (area.name) {
        case "Alpha":
          classname += " blue_border";
          break;
        case "Bravo":
          classname += " red_border";
          break;
        case "Charlie":
          classname += " yellow_border";
          break;
        case "Delta":
          classname += " green_border";
          break;
        case "Echo":
          classname += " purple_border";
          break;
        case "Foxtrot":
          classname += " pink_border";
          break;
        case "Golf":
          classname += " orange_border";
          break;
        case "Hotel":
          classname += " grey_border";
          break;
        case "Oscar":
          classname += " white_border";
          break;
      }
      const el = document.createElement("span");
      el.className = classname;
      el.textContent = area.name;
      root.appendChild(el);
    });
  } catch (e) {
    console.warn("Areas ophalen mislukt");
  }
}
