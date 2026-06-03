import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Plain HTTP health check — handy for deploy platforms and quick "is it up?" tests.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flowforge-engine', version: '0.1.0' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);

  // STEP 1 PLACEHOLDER -----------------------------------------------------
  // A once-a-second heartbeat that proves the live pipe (canvas <-> engine)
  // works. In Step 3 this is replaced by real simulation metrics streamed
  // from the discrete-event engine we build in Step 2.
  let tick = 0;
  const heartbeat = setInterval(() => {
    tick += 1;
    socket.emit('engine:heartbeat', {
      tick,
      // a gentle sine wave so the UI has something alive to render
      load: Math.round(50 + 45 * Math.sin(tick / 5)),
      at: tick * 1000,
    });
  }, 1000);
  // ------------------------------------------------------------------------

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ FlowForge engine online  →  http://localhost:${PORT}`);
  console.log(`     accepting canvas from    →  ${CLIENT_ORIGIN}\n`);
});
