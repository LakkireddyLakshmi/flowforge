import { io, type Socket } from 'socket.io-client';

// In dev, the engine runs on its own port. In production it's served from the
// same origin as this page, so we connect with no explicit URL (same-origin).
// A VITE_ENGINE_URL env var overrides both if you host them separately.
const ENGINE_URL =
  import.meta.env.VITE_ENGINE_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

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
