import { describe, it, expect } from 'vitest';
import { MinHeap } from './heap.js';
import { SimulationEngine } from './engine.js';
import { bottleneck, webStack } from './scenarios.js';
import type { Scenario } from './types.js';

describe('MinHeap', () => {
  it('always pops the smallest item', () => {
    const h = new MinHeap<number>((a, b) => a < b);
    const input = [5, 3, 8, 1, 9, 2, 7, 0, 4, 6];
    for (const x of input) h.push(x);
    const out: number[] = [];
    while (h.size > 0) out.push(h.pop()!);
    expect(out).toEqual([...input].sort((a, b) => a - b));
  });
});

describe('SimulationEngine', () => {
  it('is deterministic: same seed → identical results', () => {
    const run = () => {
      const e = new SimulationEngine(webStack);
      e.runUntil(5000);
      return e.snapshot();
    };
    const a = run();
    const b = run();
    expect(b.completed).toBe(a.completed);
    expect(b.latency.p99).toBe(a.latency.p99);
    expect(b.arrivals).toBe(a.arrivals);
  });

  it('actually moves traffic through the system', () => {
    const e = new SimulationEngine(webStack);
    e.runUntil(5000);
    const s = e.snapshot();
    expect(s.arrivals).toBeGreaterThan(0);
    expect(s.completed).toBeGreaterThan(0);
  });

  it('caches absorb load: the database sees far less traffic than the servers', () => {
    const e = new SimulationEngine(webStack);
    e.runUntil(8000);
    const s = e.snapshot();
    const servers = s.nodes
      .filter((n) => n.type === 'server')
      .reduce((sum, n) => sum + n.processed, 0);
    const db = s.nodes.find((n) => n.type === 'database')!;
    // with an 80% hit rate the DB should handle well under half the server volume
    expect(db.processed).toBeLessThan(servers * 0.5);
  });

  it('overload makes the bottleneck queue grow and latency climb', () => {
    const calm = new SimulationEngine(bottleneck);
    calm.runUntil(4000);
    const calmSnap = calm.snapshot();

    const stressed = new SimulationEngine({ ...bottleneck, loadMultiplier: 6 } as Scenario);
    stressed.runUntil(4000);
    const stressedSnap = stressed.snapshot();

    expect(stressedSnap.latency.p99).toBeGreaterThan(calmSnap.latency.p99);
    expect(stressedSnap.inFlight).toBeGreaterThan(calmSnap.inFlight);
  });

  it('the load slider changes how much traffic is generated', () => {
    const base = new SimulationEngine(bottleneck);
    base.runUntil(3000);
    const baseArrivals = base.snapshot().arrivals;

    const heavy = new SimulationEngine(bottleneck);
    heavy.setLoad(3);
    heavy.runUntil(3000);
    const heavyArrivals = heavy.snapshot().arrivals;

    expect(heavyArrivals).toBeGreaterThan(baseArrivals * 1.5);
  });
});
