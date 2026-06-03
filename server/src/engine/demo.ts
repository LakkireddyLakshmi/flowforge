/**
 * A terminal demo so you can watch the engine work before any UI exists.
 *   npm run demo --workspace server
 *
 * It runs the "web stack" scenario for 10 virtual seconds, printing a metrics
 * frame every second — like a tiny text version of the dashboard we'll build.
 */
import { SimulationEngine } from './engine.js';
import { webStack } from './scenarios.js';

const engine = new SimulationEngine(webStack);
const FRAME_MS = 1000;
const FRAMES = 10;

const pad = (s: string | number, n: number) => String(s).padStart(n);

console.log('\n  FlowForge engine — "web stack" demo (10s)\n');
console.log('   t   arrived  done  drop  inFlight   p99(ms)   bottleneck');
console.log('  ─────────────────────────────────────────────────────────');

for (let i = 1; i <= FRAMES; i++) {
  engine.runUntil(i * FRAME_MS);
  const s = engine.snapshot();
  const hot = s.nodes
    .filter((n) => n.type !== 'source')
    .sort((a, b) => b.utilization - a.utilization)[0];
  console.log(
    `  ${pad(i + 's', 3)}  ${pad(s.arrivals, 7)}  ${pad(s.completed, 4)}  ${pad(
      s.dropped,
      4,
    )}  ${pad(s.inFlight, 8)}  ${pad(s.latency.p99.toFixed(1), 8)}   ${
      hot ? `${hot.label} @ ${(hot.utilization * 100).toFixed(0)}%` : '—'
    }`,
  );
}

console.log('\n  Tip: bump the load with engine.setLoad(4) and watch p99 climb.\n');
