import { describe, it, expect } from 'vitest';
import { sanitizeScenario } from './validate.js';

describe('sanitizeScenario', () => {
  it('accepts a valid custom architecture', () => {
    const s = sanitizeScenario({
      components: [
        { id: 'c', type: 'source', rate: 30 },
        { id: 'api', type: 'server', capacity: 3, serviceTime: 15 },
      ],
      edges: [{ id: 'e1', from: 'c', to: 'api' }],
    });
    expect(s).not.toBeNull();
    expect(s!.components).toHaveLength(2);
    expect(s!.edges).toHaveLength(1);
  });

  it('rejects unknown component types', () => {
    expect(
      sanitizeScenario({ components: [{ id: 'x', type: 'malware' }], edges: [] }),
    ).toBeNull();
  });

  it('rejects duplicate ids and empty graphs', () => {
    expect(
      sanitizeScenario({
        components: [
          { id: 'a', type: 'server' },
          { id: 'a', type: 'server' },
        ],
        edges: [],
      }),
    ).toBeNull();
    expect(sanitizeScenario({ components: [], edges: [] })).toBeNull();
  });

  it('drops edges that point at non-existent nodes', () => {
    const s = sanitizeScenario({
      components: [{ id: 'a', type: 'source' }],
      edges: [
        { id: 'ok-but-dangling', from: 'a', to: 'ghost' },
        { id: 'keep', from: 'a', to: 'a' },
      ],
    });
    expect(s!.edges).toHaveLength(1);
    expect(s!.edges[0].from).toBe('a');
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const s = sanitizeScenario({
      components: [{ id: 'db', type: 'database', capacity: 999999, failureRate: 5 }],
      edges: [],
    });
    expect(s!.components[0].capacity).toBeLessThanOrEqual(100_000);
    expect(s!.components[0].failureRate).toBe(1); // clamped from 5 → 1
  });

  it('rejects junk input', () => {
    expect(sanitizeScenario(null)).toBeNull();
    expect(sanitizeScenario('nope')).toBeNull();
    expect(sanitizeScenario({ components: 'x', edges: [] })).toBeNull();
  });
});
