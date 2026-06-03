import type { ComponentType, Scenario } from '../engine/types.js';

const TYPES: ReadonlySet<string> = new Set<ComponentType>([
  'source',
  'loadbalancer',
  'server',
  'cache',
  'queue',
  'database',
  'sink',
]);

const MAX_COMPONENTS = 40;
const MAX_EDGES = 200;

/** Clamp a value into [min, max], or return undefined if it isn't a finite number. */
function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
}

/**
 * Turn untrusted client input into a safe Scenario, or null if it's unusable.
 *
 * Never trust the browser: a custom architecture arrives as arbitrary JSON, so
 * we whitelist component types, clamp every number to a sane range, drop edges
 * that point at non-existent nodes, and cap the total size. A bad payload can't
 * crash or wedge the engine.
 */
export function sanitizeScenario(raw: unknown): Scenario | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.components) || !Array.isArray(obj.edges)) return null;

  const ids = new Set<string>();
  const components: Scenario['components'] = [];

  for (const c of obj.components.slice(0, MAX_COMPONENTS)) {
    if (typeof c !== 'object' || c === null) return null;
    const comp = c as Record<string, unknown>;
    if (typeof comp.id !== 'string' || !TYPES.has(comp.type as string)) return null;
    if (ids.has(comp.id)) return null;
    ids.add(comp.id);

    components.push({
      id: comp.id,
      type: comp.type as ComponentType,
      label: typeof comp.label === 'string' ? comp.label.slice(0, 40) : undefined,
      capacity: num(comp.capacity, 1, 100_000),
      serviceTime: num(comp.serviceTime, 0, 100_000),
      maxQueue: num(comp.maxQueue, 0, 1_000_000),
      failureRate: num(comp.failureRate, 0, 1),
      rate: num(comp.rate, 0, 100_000),
      hitRate: num(comp.hitRate, 0, 1),
    });
  }

  if (components.length === 0) return null;

  const edges: Scenario['edges'] = [];
  let i = 0;
  for (const e of obj.edges.slice(0, MAX_EDGES)) {
    if (typeof e !== 'object' || e === null) continue;
    const edge = e as Record<string, unknown>;
    if (!ids.has(edge.from as string) || !ids.has(edge.to as string)) continue;
    edges.push({
      id: typeof edge.id === 'string' ? edge.id : `e${i++}`,
      from: edge.from as string,
      to: edge.to as string,
    });
  }

  return { components, edges, seed: 42, loadMultiplier: 1 };
}
