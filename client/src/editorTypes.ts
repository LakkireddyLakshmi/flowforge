import type { ComponentSpec, ComponentType } from './types';

export const ICON: Record<ComponentType, string> = {
  source: '👤',
  loadbalancer: '⚖️',
  server: '🖥️',
  cache: '⚡',
  queue: '📥',
  database: '🗄️',
  sink: '🏁',
};

/** The component types you can drop on the canvas, in palette order. */
export const PALETTE: { type: ComponentType; label: string }[] = [
  { type: 'source', label: 'Client' },
  { type: 'loadbalancer', label: 'Load Balancer' },
  { type: 'server', label: 'Server' },
  { type: 'cache', label: 'Cache' },
  { type: 'queue', label: 'Queue' },
  { type: 'database', label: 'Database' },
  { type: 'sink', label: 'Sink' },
];

/** Starting parameters for a freshly added component. */
export const DEFAULTS: Record<ComponentType, Partial<ComponentSpec>> = {
  source: { rate: 50 },
  loadbalancer: { capacity: 1000, serviceTime: 0.5 },
  server: { capacity: 4, serviceTime: 20, failureRate: 0.01 },
  cache: { capacity: 1000, serviceTime: 1, hitRate: 0.8 },
  queue: { capacity: 1, serviceTime: 5 },
  database: { capacity: 2, serviceTime: 30, failureRate: 0.005 },
  sink: {},
};

export interface FieldDef {
  key: keyof ComponentSpec;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Which knobs the properties panel shows for each component type. */
export const FIELDS: Record<ComponentType, FieldDef[]> = {
  source: [{ key: 'rate', label: 'Rate (req/s)', min: 0, max: 2000, step: 5 }],
  loadbalancer: [
    { key: 'capacity', label: 'Capacity', min: 1, max: 5000, step: 1 },
    { key: 'serviceTime', label: 'Service (ms)', min: 0, max: 1000, step: 0.5 },
  ],
  server: [
    { key: 'capacity', label: 'Capacity (workers)', min: 1, max: 128, step: 1 },
    { key: 'serviceTime', label: 'Service (ms)', min: 0, max: 2000, step: 1 },
    { key: 'maxQueue', label: 'Max queue', min: 0, max: 100000, step: 10 },
    { key: 'failureRate', label: 'Failure rate', min: 0, max: 1, step: 0.01 },
  ],
  cache: [
    { key: 'hitRate', label: 'Hit rate', min: 0, max: 1, step: 0.01 },
    { key: 'serviceTime', label: 'Service (ms)', min: 0, max: 1000, step: 0.5 },
    { key: 'capacity', label: 'Capacity', min: 1, max: 5000, step: 1 },
  ],
  queue: [
    { key: 'capacity', label: 'Consumers', min: 1, max: 128, step: 1 },
    { key: 'serviceTime', label: 'Service (ms)', min: 0, max: 2000, step: 1 },
    { key: 'maxQueue', label: 'Max queue', min: 0, max: 1000000, step: 100 },
  ],
  database: [
    { key: 'capacity', label: 'Capacity', min: 1, max: 128, step: 1 },
    { key: 'serviceTime', label: 'Service (ms)', min: 0, max: 5000, step: 1 },
    { key: 'maxQueue', label: 'Max queue', min: 0, max: 100000, step: 10 },
    { key: 'failureRate', label: 'Failure rate', min: 0, max: 1, step: 0.01 },
  ],
  sink: [],
};

export const labelFor = (type: ComponentType) =>
  PALETTE.find((p) => p.type === type)?.label ?? type;
