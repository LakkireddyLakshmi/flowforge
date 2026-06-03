# ⚡ FlowForge

**A live system-design simulator.** Draw a backend architecture on a canvas —
clients, load balancers, API servers, caches, queues, databases, workers — then
press **▶ Play** and watch real simulated traffic flow through *your* diagram.
Queues fill up and turn red. A database hot-spots under a spike. p99 latency
climbs on a live chart until the system melts. Drop in a cache, hit play again,
and watch it survive.

It's "draw your architecture, then watch it run and break under load."

---

## Why it exists

Static diagram tools (Excalidraw, draw.io) draw boxes. Load-test tools hammer
real servers. **FlowForge sits in between**: it runs a real *discrete-event
simulation* of traffic through an architecture you sketch, so you can *see* why
you need a cache, *what* happens without a queue, and *where* the bottleneck is —
before writing a line of infrastructure.

## Architecture

```
client/   React + TypeScript + Vite   →  the canvas + live charts
server/   Node + Express + Socket.IO  →  the discrete-event simulation engine
```

The engine is a **graph** of components plus a **priority-queue event
scheduler** running on a virtual clock. Metrics stream to the canvas over a
WebSocket in real time.

## Run it locally

```bash
npm install        # installs both workspaces
npm run dev        # starts engine (:3001) + canvas (:5173) together
```

Then open <http://localhost:5173>.

| Command | What it does |
| --- | --- |
| `npm run dev` | run engine + canvas together |
| `npm run dev:server` | run just the engine |
| `npm run dev:client` | run just the canvas |
| `npm run typecheck` | type-check both workspaces |
| `npm test` | run the engine's unit tests |

## Build status

- [x] **Step 1** — monorepo skeleton + live WebSocket pipe
- [ ] **Step 2** — discrete-event simulation engine
- [ ] **Step 3** — stream live sim metrics to the canvas
- [ ] **Step 4** — drag/drop canvas, edges, Play + load slider, live charts
- [ ] **Step 5** — tests, polish, deploy
