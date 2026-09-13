import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// Connection is deferred (autoConnect: false) because the server now
// requires a valid JWT in the handshake — call connectSocket(token) once
// the user is logged in, before emitting room:join.
export const socket = io(SOCKET_URL, { autoConnect: false });

export function connectSocket(token) {
  socket.auth = { token };
  if (socket.connected) socket.disconnect();
  socket.connect();
}