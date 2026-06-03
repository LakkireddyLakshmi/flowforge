import { io, type Socket } from 'socket.io-client';

// The engine's address. Override in production with a VITE_ENGINE_URL env var.
const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:3001';

export const socket: Socket = io(ENGINE_URL, {
  autoConnect: true,
  // keep trying forever, with a short backoff, so the page heals itself the
  // moment the engine comes back (e.g. after a server restart)
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 8000,
});
