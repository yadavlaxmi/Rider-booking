import { io } from "socket.io-client";
import { getAuthToken } from "../services/session";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: {
    token: getAuthToken(),
  },
});

export function connectSocket() {
  socket.auth = { token: getAuthToken() };
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

export default socket;
