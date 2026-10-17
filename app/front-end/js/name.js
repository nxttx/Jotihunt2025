// =====================
// Hoofdstuk: Naam bewaren (localStorage)
// =====================
(() => {
  const KEY = "username";

  function load(el) {
    el.value = localStorage.getItem(KEY) || "";
  }
  function save(v) {
    localStorage.setItem(KEY, v || "");
  }

  function init() {
    const input = document.getElementById("name-input");
    if (!input) return;
    load(input);
    input.addEventListener("blur", (e) => save(e.target.value));
    // sync richting socket bij blur
    input.addEventListener("blur", (e) =>
      window.SocketAPI?.updateName?.(e.target.value)
    );
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
