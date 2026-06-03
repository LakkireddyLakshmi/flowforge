import type { Scenario } from './types.js';

/**
 * The classic web stack:  client → load balancer → 2 servers → cache → database
 *
 * With the cache in front, most reads never reach the database — so the system
 * stays healthy. Try deleting the cache edge (server → database directly) and
 * watch the database become the bottleneck.
 */
export const webStack: Scenario = {
  seed: 42,
  loadMultiplier: 1,
  components: [
    { id: 'client', type: 'source', label: 'Client', rate: 60 },
    { id: 'lb', type: 'loadbalancer', label: 'Load Balancer' },
    { id: 'api1', type: 'server', label: 'API #1', capacity: 4, serviceTime: 18 },
    { id: 'api2', type: 'server', label: 'API #2', capacity: 4, serviceTime: 18 },
    { id: 'cache', type: 'cache', label: 'Redis Cache', hitRate: 0.8 },
    { id: 'db', type: 'database', label: 'Postgres', capacity: 2, serviceTime: 30 },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'lb' },
    { id: 'e2', from: 'lb', to: 'api1' },
    { id: 'e3', from: 'lb', to: 'api2' },
    { id: 'e4', from: 'api1', to: 'cache' },
    { id: 'e5', from: 'api2', to: 'cache' },
    { id: 'e6', from: 'cache', to: 'db' },
  ],
};

/**
 * A deliberately under-provisioned stack: one slow database behind one server,
 * no cache. Push the load up and watch the queue and latency explode.
 */
export const bottleneck: Scenario = {
  seed: 7,
  loadMultiplier: 1,
  components: [
    { id: 'client', type: 'source', label: 'Client', rate: 40 },
    { id: 'api', type: 'server', label: 'API', capacity: 2, serviceTime: 20 },
    { id: 'db', type: 'database', label: 'Database', capacity: 1, serviceTime: 40 },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'api' },
    { id: 'e2', from: 'api', to: 'db' },
  ],
};

export const scenarios = { webStack, bottleneck };
