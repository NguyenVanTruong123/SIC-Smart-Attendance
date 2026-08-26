import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";

// =============================================================================
// Socket.io client — Namespace /attendance (§6 docs)
// =============================================================================

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    socket = io("/attendance", {
      path: "/ws",
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

export function joinSession(sessionId: string): void {
  const s = connectSocket();
  s.emit("attendance:join_session", { sessionId });
}

export function leaveSession(sessionId: string): void {
  const s = getSocket();
  s.emit("attendance:leave_session", { sessionId });
}
