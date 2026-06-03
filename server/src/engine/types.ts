/** The kinds of building blocks you can drop on the canvas. */
export type ComponentType =
  | 'source' // generates traffic (a client / load generator)
  | 'loadbalancer' // fans requests out across downstream targets
  | 'server' // an API server: limited concurrency, takes time per request
  | 'cache' // serves hits instantly; only misses flow downstream
  | 'queue' // buffers work for slow consumers
  | 'database' // low concurrency, slow — the classic bottleneck
  | 'sink'; // an explicit "request is done" endpoint

/** One node in the architecture graph, with its tuning knobs. */
export interface ComponentSpec {
  id: string;
  type: ComponentType;
  label?: string;
  /** Concurrent requests it can handle at once (think: number of workers). */
  capacity?: number;
  /** Mean milliseconds to process one request. */
  serviceTime?: number;
  /** Waiting-room size; once full, new requests are dropped. Default: unlimited. */
  maxQueue?: number;
  /** Probability (0..1) a request errors out here. */
  failureRate?: number;
  /** Requests/second generated — `source` only. */
  rate?: number;
  /** Probability (0..1) a lookup is a hit — `cache` only. */
  hitRate?: number;
}

/** A directed connection: requests leaving `from` head to `to`. */
export interface EdgeSpec {
  id: string;
  from: string;
  to: string;
}

/** A complete architecture plus how to run it. */
export interface Scenario {
  components: ComponentSpec[];
  edges: EdgeSpec[];
  /** Seed for reproducible runs. */
  seed?: number;
  /** The "load slider": multiplies every source's rate. 1 = as configured. */
  loadMultiplier?: number;
}

/** How healthy a node looks right now — drives the red/green colouring. */
export type Health = 'idle' | 'ok' | 'busy' | 'overloaded';

/** Live stats for a single node, recomputed every frame. */
export interface NodeMetrics {
  id: string;
  type: ComponentType;
  label: string;
  inFlight: number; // slots currently busy
  queueDepth: number; // requests waiting
  capacity: number;
  utilization: number; // 0..1 over the last frame
  throughput: number; // requests/sec processed over the last frame
  processed: number; // cumulative
  dropped: number; // cumulative
  failed: number; // cumulative
  health: Health;
}

/** One edge that carried traffic this frame — used to animate the canvas. */
export interface Flow {
  from: string;
  to: string;
  count: number;
}

/** A full picture of the system at one instant — what we stream to the canvas. */
export interface SimSnapshot {
  time: number; // virtual clock, ms
  nodes: NodeMetrics[];
  completed: number; // cumulative successful
  dropped: number; // cumulative rejected (full queue)
  failed: number; // cumulative errored
  inFlight: number; // requests currently in the system
  arrivals: number; // cumulative generated
  throughput: number; // successful requests/sec over the last frame
  latency: { p50: number; p95: number; p99: number; avg: number };
  flows: Flow[];
}
