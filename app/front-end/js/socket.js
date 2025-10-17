(() => {
  const socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
  });

  function getClientId() {
    const KEY = "clientId";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function getName() {
    return (document.getElementById("name-input")?.value || "").trim();
  }

  function connect() {
    const cid = getClientId();
    if (!socket.connected) socket.connect();

    if (socket.connected) {
      socket.emit("hello", { clientId: cid, name: getName() });
    } else {
      socket.once("connect", () => {
        socket.emit("hello", { clientId: cid, name: getName() });
      });
    }
  }

  function updateName(name) {
    socket.emit("hello", {
      clientId: getClientId(),
      name: (name || "").trim(),
    });
  }

  function sendLocation(lat, lng, accuracy) {
    if (!socket.connected) return;
    socket.emit("location:update", {
      clientId: getClientId(),
      name: getName(),
      lat,
      lng,
      accuracy,
    });
  }

  function updateDraggable(lat, lng) {
    if (!socket.connected) return;
    socket.emit("draggable:update", { lat, lng });
  }

  function setVisited(id, visited) {
    if (!socket.connected) return;
    socket.emit("visited:set", { id, visited });
  }

  function leave() {
    try {
      socket.emit("peer:leave", { clientId: getClientId() });
    } catch {}
    try {
      socket.close();
    } catch {}
  }

  window.addEventListener("beforeunload", leave, { once: true });

  window.SocketAPI = {
    socket,
    connect,
    updateName,
    sendLocation,
    updateDraggable,
    setVisited,
    leave,
    getClientId,
  };
})();
