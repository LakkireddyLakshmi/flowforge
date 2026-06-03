import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SimSession } from './sim/session.js';
import { scenarios } from './engine/scenarios.js';
import type { Scenario } from './engine/types.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flowforge-engine', version: '0.1.0' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

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

  socket.on('disconnect', () => {
    session.stop();
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ FlowForge engine online  →  http://localhost:${PORT}`);
  console.log(`     accepting canvas from    →  ${CLIENT_ORIGIN}\n`);
});
