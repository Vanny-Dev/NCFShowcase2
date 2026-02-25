import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      withCredentials: true,
      transports: ["websocket", "polling"], // prefer websocket, fallback to polling
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("🟢 Socket connected:", socket.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
    });
    socket.on("connect_error", (err) => {
      console.warn("⚠️ Socket connection error:", err.message);
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export const SOCKET_EVENTS = {
  QUEUE_UPDATED:       "queue:updated",
  TICKET_CALLED:       "ticket:called",
  TICKET_SERVED:       "ticket:served",
  TICKET_SKIPPED:      "ticket:skipped",
  ANALYTICS_UPDATED:   "analytics:updated",
  COUNTER_UPDATED:     "counter:updated",
  JOIN_QUEUE_ROOM:     "join:queue-room",
  JOIN_TICKET_ROOM:    "join:ticket-room",
  LEAVE_TICKET_ROOM:   "leave:ticket-room",
  JOIN_COUNTER_ROOM:   "join:counter-room",
  LEAVE_COUNTER_ROOM:  "leave:counter-room",
  CLAIM_WINDOW:        "claim:window",
  RELEASE_WINDOW:      "release:window",
  WINDOWS_UPDATED:     "windows:updated",
};