import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    // Même origine (proxy Vite) : le cookie httpOnly est transmis automatiquement.
    socket = io({ transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
