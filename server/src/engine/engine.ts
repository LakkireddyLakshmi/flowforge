import { MinHeap } from './heap.js';
import { Rng } from './rng.js';
import type {
  ComponentType,
  Flow,
  Health,
  NodeMetrics,
  Scenario,
  SimSnapshot,
} from './types.js';

/** A single request travelling through the system. */
interface SimRequest {
  id: number;
  bornAt: number; // virtual time it entered the system
  hops: number;
}

/** Something scheduled to happen at a future virtual time. */
interface SimEvent {
  time: number;
  seq: number; // tie-breaker so equal-time events keep insertion order
  kind: 'generate' | 'arrival' | 'departure';
  nodeId: string;
  req?: SimRequest;
}

/** A node's live, mutable state during a run. */
interface NodeRuntime {
  id: string;
  type: ComponentType;
  label: string;
  capacity: number;
  serviceTime: number;
  maxQueue: number;
  failureRate: number;
  rate: number; // source only
  hitRate: number; // cache only

  busy: number; // slots in use
  queue: SimRequest[]; // waiting requests
  rr: number; // round-robin pointer for routing

  // cumulative
  processed: number;
  dropped: number;
  failed: number;

  // per-frame accumulators (reset on each snapshot)
  processedWindow: number;
  droppedWindow: number;
  busyArea: number; // integral of busy-slots over time → average utilization
  lastBusyUpdate: number;
}

/** Sensible defaults per component type, so a freshly dropped node "just works". */
const DEFAULTS: Record<
  ComponentType,
  { capacity: number; serviceTime: number; failureRate: number; rate: number; hitRate: number }
> = {
  source: { capacity: 0, serviceTime: 0, failureRate: 0, rate: 50, hitRate: 0 },
  loadbalancer: { capacity: 1000, serviceTime: 0.5, failureRate: 0, rate: 0, hitRate: 0 },
  server: { capacity: 4, serviceTime: 20, failureRate: 0.01, rate: 0, hitRate: 0 },
  cache: { capacity: 1000, serviceTime: 1, failureRate: 0, rate: 0, hitRate: 0.8 },
  queue: { capacity: 1, serviceTime: 5, failureRate: 0, rate: 0, hitRate: 0 },
  database: { capacity: 2, serviceTime: 30, failureRate: 0.005, rate: 0, hitRate: 0 },
  sink: { capacity: 1000, serviceTime: 0, failureRate: 0, rate: 0, hitRate: 0 },
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.floor((p / 100) * sorted.length), 0, sorted.length - 1);
  return sorted[idx];
}

/**
 * The discrete-event simulation engine.
 *
 * Pure and portable on purpose: it imports nothing from Node, so the exact same
 * class can run server-side *and* inside a browser Web Worker (the offline
 * fallback). You feed it a Scenario, then repeatedly call `runUntil(t)` to fast-
 * forward the virtual clock and `snapshot()` to read the metrics for that frame.
 */
export class SimulationEngine {
  private clock = 0;
  private seq = 0;
  private nextReqId = 1;
  private loadMultiplier: number;

  private readonly rng: Rng;
  private readonly events = new MinHeap<SimEvent>(
    (a, b) => a.time < b.time || (a.time === b.time && a.seq < b.seq),
  );
  private readonly nodes = new Map<string, NodeRuntime>();
  private readonly adj = new Map<string, string[]>();

  // global cumulative counters
  private completed = 0;
  private dropped = 0;
  private failed = 0;
  private arrivals = 0;

  // global per-frame accumulators
  private completedWindow = 0;
  private latWindow: number[] = [];
  private flows = new Map<string, Flow>();
  private lastSnap = 0;

  constructor(scenario: Scenario) {
    this.rng = new Rng(scenario.seed ?? 1);
    this.loadMultiplier = scenario.loadMultiplier ?? 1;

    for (const spec of scenario.components) {
      const d = DEFAULTS[spec.type];
      this.nodes.set(spec.id, {
        id: spec.id,
        type: spec.type,
        label: spec.label ?? spec.id,
        capacity: spec.capacity ?? d.capacity,
        serviceTime: spec.serviceTime ?? d.serviceTime,
        maxQueue: spec.maxQueue ?? Number.POSITIVE_INFINITY,
        failureRate: spec.failureRate ?? d.failureRate,
        rate: spec.rate ?? d.rate,
        hitRate: spec.hitRate ?? d.hitRate,
        busy: 0,
        queue: [],
        rr: 0,
        processed: 0,
        dropped: 0,
        failed: 0,
        processedWindow: 0,
        droppedWindow: 0,
        busyArea: 0,
        lastBusyUpdate: 0,
      });
      this.adj.set(spec.id, []);
    }

    for (const edge of scenario.edges) {
      this.adj.get(edge.from)?.push(edge.to);
    }

    // kick off each source's traffic generation
    for (const node of this.nodes.values()) {
      if (node.type === 'source') this.schedule(0, 'generate', node.id);
    }
  }

  get time(): number {
    return this.clock;
  }

  /** Live "load slider": scales how much traffic every source produces. */
  setLoad(multiplier: number): void {
    this.loadMultiplier = Math.max(0, multiplier);
  }

  /** Fast-forward, processing every event up to and including virtual time `t`. */
  runUntil(t: number): void {
    let guard = 0;
    const MAX = 5_000_000; // safety valve against a runaway scenario
    while (this.events.size > 0 && this.events.peek()!.time <= t) {
      const ev = this.events.pop()!;
      this.clock = ev.time;
      this.process(ev);
      if (++guard > MAX) break;
    }
    if (t > this.clock) this.clock = t;
  }

  private schedule(time: number, kind: SimEvent['kind'], nodeId: string, req?: SimRequest): void {
    this.events.push({ time, seq: this.seq++, kind, nodeId, req });
  }

  private process(ev: SimEvent): void {
    switch (ev.kind) {
      case 'generate':
        this.onGenerate(ev.nodeId);
        break;
      case 'arrival':
        this.onArrival(ev.nodeId, ev.req!);
        break;
      case 'departure':
        this.onDeparture(ev.nodeId, ev.req!);
        break;
    }
  }

  private onGenerate(sourceId: string): void {
    const node = this.nodes.get(sourceId)!;
    const now = this.clock;
    const effRate = node.rate * this.loadMultiplier;

    if (effRate > 0) {
      const req: SimRequest = { id: this.nextReqId++, bornAt: now, hops: 0 };
      this.arrivals++;
      node.processed++;
      node.processedWindow++;

      const target = this.chooseTarget(node);
      if (target) {
        this.recordFlow(sourceId, target);
        this.schedule(now, 'arrival', target, req);
      } else {
        this.finish(req, 'ok'); // nowhere to go — count it as instantly done
      }

      const gap = this.rng.exponential(1000 / effRate);
      this.schedule(now + gap, 'generate', sourceId);
    } else {
      // paused (load slider at 0): poll again soon so raising it resumes traffic
      this.schedule(now + 200, 'generate', sourceId);
    }
  }

  private onArrival(nodeId: string, req: SimRequest): void {
    const node = this.nodes.get(nodeId)!;
    const now = this.clock;
    req.hops++;
    this.touch(node, now);

    if (node.busy < node.capacity) {
      node.busy++;
      this.schedule(now + this.sampleService(node), 'departure', nodeId, req);
    } else if (node.queue.length < node.maxQueue) {
      node.queue.push(req);
    } else {
      node.dropped++;
      node.droppedWindow++;
      this.dropped++;
    }
  }

  private onDeparture(nodeId: string, req: SimRequest): void {
    const node = this.nodes.get(nodeId)!;
    const now = this.clock;
    this.touch(node, now);
    node.busy--;
    node.processed++;
    node.processedWindow++;

    if (node.failureRate > 0 && this.rng.chance(node.failureRate)) {
      node.failed++;
      this.finish(req, 'failed');
    } else if (node.type === 'cache' && this.rng.chance(node.hitRate)) {
      this.finish(req, 'ok'); // cache hit — served here, never touches the DB
    } else {
      const target = this.chooseTarget(node);
      if (target) {
        this.recordFlow(nodeId, target);
        this.schedule(now, 'arrival', target, req);
      } else {
        this.finish(req, 'ok'); // no downstream — the request is done
      }
    }

    // a slot just freed up — pull the next waiting request in
    if (node.queue.length > 0) {
      const next = node.queue.shift()!;
      node.busy++;
      this.schedule(now + this.sampleService(node), 'departure', nodeId, next);
    }
  }

  private chooseTarget(node: NodeRuntime): string | null {
    const targets = this.adj.get(node.id);
    if (!targets || targets.length === 0) return null;
    if (targets.length === 1) return targets[0];
    // multiple downstreams → spread across them round-robin (load balancing)
    const t = targets[node.rr % targets.length];
    node.rr++;
    return t;
  }

  private sampleService(node: NodeRuntime): number {
    return node.serviceTime <= 0 ? 0 : this.rng.exponential(node.serviceTime);
  }

  /** Accumulate the busy-slot-time integral so we can average utilization later. */
  private touch(node: NodeRuntime, now: number): void {
    node.busyArea += node.busy * (now - node.lastBusyUpdate);
    node.lastBusyUpdate = now;
  }

  private finish(req: SimRequest, status: 'ok' | 'failed'): void {
    this.latWindow.push(this.clock - req.bornAt);
    if (status === 'ok') {
      this.completed++;
      this.completedWindow++;
    } else {
      this.failed++;
    }
  }

  private recordFlow(from: string, to: string): void {
    const key = `${from}|${to}`;
    const existing = this.flows.get(key);
    if (existing) existing.count++;
    else this.flows.set(key, { from, to, count: 1 });
  }

  /** Read the metrics for the frame since the last snapshot, then reset the window. */
  snapshot(): SimSnapshot {
    const now = this.clock;
    const windowMs = Math.max(1e-6, now - this.lastSnap);
    const windowSec = windowMs / 1000;

    const nodeMetrics: NodeMetrics[] = [];
    let inFlight = 0;

    for (const node of this.nodes.values()) {
      this.touch(node, now);
      const cap = node.capacity > 0 ? node.capacity : 1;
      const utilization = clamp(node.busyArea / (cap * windowMs), 0, 1);
      const throughput = node.processedWindow / windowSec;
      inFlight += node.busy + node.queue.length;

      nodeMetrics.push({
        id: node.id,
        type: node.type,
        label: node.label,
        inFlight: node.busy,
        queueDepth: node.queue.length,
        capacity: node.capacity,
        utilization,
        throughput,
        processed: node.processed,
        dropped: node.dropped,
        failed: node.failed,
        health: this.health(node, utilization),
      });

      // reset per-frame accumulators
      node.processedWindow = 0;
      node.droppedWindow = 0;
      node.busyArea = 0;
      node.lastBusyUpdate = now;
    }

    const sorted = [...this.latWindow].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((s, x) => s + x, 0) / sorted.length : 0;

    const snap: SimSnapshot = {
      time: now,
      nodes: nodeMetrics,
      completed: this.completed,
      dropped: this.dropped,
      failed: this.failed,
      inFlight,
      arrivals: this.arrivals,
      throughput: this.completedWindow / windowSec,
      latency: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        avg,
      },
      flows: [...this.flows.values()],
    };

    // reset global window
    this.completedWindow = 0;
    this.latWindow.length = 0;
    this.flows.clear();
    this.lastSnap = now;

    return snap;
  }

  private health(node: NodeRuntime, utilization: number): Health {
    if (node.type === 'source') return 'ok';
    const q = node.queue.length;
    if (node.droppedWindow > 0 || utilization >= 0.9 || q > node.capacity * 3) return 'overloaded';
    if (utilization >= 0.6 || q > 0) return 'busy';
    if (utilization > 0.05 || node.busy > 0) return 'ok';
    return 'idle';
  }
}
