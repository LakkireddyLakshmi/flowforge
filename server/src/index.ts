import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { SimSession } from './sim/session.js';
import { sanitizeScenario } from './sim/validate.js';
import { scenarios } from './engine/scenarios.js';
import type { Scenario } from './engine/types.js';

const PORT = Number(process.env.PORT ?? 3001);
const PROD = process.env.NODE_ENV === 'production';
// In production the client is served from this same origin, so reflect the
// request origin; in dev, allow the Vite dev server explicitly.
const ORIGIN: string | boolean = process.env.CLIENT_ORIGIN ?? (PROD ? true : 'http://localhost:5173');

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flowforge-engine', version: '0.1.0' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: ORIGIN } });

const SCENARIOS: Record<string, Scenario> = scenarios;

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Each browser gets its own private simulation, auto-started on the web stack.
  const session = new SimSession(scenarios.webStack, (snap) => {
    socket.emit('sim:snapshot', snap);
  });

  // Tell the client which architectures exist and what's currently running, so
  // it can draw the graph (Step 4) and render metrics against it.
  const sendGraph = () => {
    socket.emit('sim:graph', {
      available: Object.keys(SCENARIOS),
      scenario: session.getScenario(),
    });
  };

  session.start();
  sendGraph();

  socket.on('sim:load', (m: unknown) => session.setLoad(Number(m) || 0));
  socket.on('sim:speed', (s: unknown) => session.setSpeed(Number(s) || 1));
  socket.on('sim:pause', () => session.pause());
  socket.on('sim:resume', () => session.resume());
  socket.on('sim:reset', () => {
    session.reset();
    sendGraph();
  });
  socket.on('sim:scenario', (name: unknown) => {
    const scenario = SCENARIOS[String(name)] ?? scenarios.webStack;
    session.reset(scenario);
    sendGraph();
  });
  socket.on('sim:custom', (raw: unknown) => {
    const scenario = sanitizeScenario(raw);
    if (!scenario) {
      socket.emit('sim:error', 'That architecture could not be run (needs at least one component).');
      return;
    }
    session.reset(scenario);
    sendGraph();
  });

  socket.on('disconnect', () => {
    session.stop();
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// In production, serve the built React app from this same server (single
// deployment: one origin for both the canvas and the engine).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
if (existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ FlowForge engine online  →  http://localhost:${PORT}`);
  console.log(`     mode                     →  ${PROD ? 'production' : 'development'}`);
  if (existsSync(path.join(clientDist, 'index.html'))) {
    console.log(`     serving canvas from      →  ${clientDist}`);
  }
  console.log('');
});
