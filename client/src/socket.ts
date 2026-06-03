import { io, type Socket } from 'socket.io-client';

// The engine's address. Override in production with a VITE_ENGINE_URL env var.
const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:3001';

export const socket: Socket = io(ENGINE_URL, {
  autoConnect: true,
});
