// These mirror the engine's output types on the server (server/src/engine/types.ts).
// Kept as a small standalone copy so the client has no build-time dependency on
// the server package. If the engine's snapshot shape changes, update both.

export type ComponentType =
  | 'source'
  | 'loadbalancer'
  | 'server'
  | 'cache'
  | 'queue'
  | 'database'
  | 'sink';

export type Health = 'idle' | 'ok' | 'busy' | 'overloaded';

export interface NodeMetrics {
  id: string;
  type: ComponentType;
  label: string;
  inFlight: number;
  queueDepth: number;
  capacity: number;
  utilization: number;
  throughput: number;
  processed: number;
  dropped: number;
  failed: number;
  health: Health;
}

export interface Flow {
  from: string;
  to: string;
  count: number;
}

export interface SimSnapshot {
  time: number;
  nodes: NodeMetrics[];
  completed: number;
  dropped: number;
  failed: number;
  inFlight: number;
  arrivals: number;
  throughput: number;
  latency: { p50: number; p95: number; p99: number; avg: number };
  flows: Flow[];
}

export interface ComponentSpec {
  id: string;
  type: ComponentType;
  label?: string;
  capacity?: number;
  serviceTime?: number;
  maxQueue?: number;
  failureRate?: number;
  rate?: number;
  hitRate?: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface EditGraph {
  components: ComponentSpec[];
  edges: Edge[];
}

export interface GraphSpec {
  available: string[];
  scenario: EditGraph;
}

export type ConnStatus = 'connecting' | 'live' | 'reconnecting';
