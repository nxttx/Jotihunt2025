// =====================
// Hoofdstuk: SocketAPI
// =====================
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
    const hello = () =>
      socket.emit("hello", { clientId: cid, name: getName() });
    socket.connected ? hello() : socket.once("connect", hello);
  }

  const guard = () => socket.connected;

  const api = {
    socket,
    connect,
    updateName(name) {
      socket.emit("hello", {
        clientId: getClientId(),
        name: (name || "").trim(),
      });
    },
    sendLocation(lat, lng, accuracy) {
      if (!guard()) return;
      socket.emit("location:update", {
        clientId: getClientId(),
        name: getName(),
        lat,
        lng,
        accuracy,
      });
    },
    updateDraggable(lat, lng) {
      if (!guard()) return;
      socket.emit("draggable:update", { lat, lng });
    },
    setVisited(id, visited) {
      if (!guard()) return;
      socket.emit("visited:set", { id, visited });
    },
    createVos(vos) {
      if (!guard()) return;
      socket.emit("vos:create", vos);
    },
    updateVos(vos) {
      if (!guard()) return;
      socket.emit("vos:update", vos);
    },
    removeVos(id) {
      if (!guard()) return;
      socket.emit("vos:remove", { id });
    },
    leave() {
      try {
        socket.emit("peer:leave", { clientId: getClientId() });
      } catch {}
      try {
        socket.close();
      } catch {}
    },
    getClientId,
  };

  window.addEventListener("beforeunload", api.leave, { once: true });
  window.SocketAPI = api;
})();
