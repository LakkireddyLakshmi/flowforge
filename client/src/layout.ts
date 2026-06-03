import type { GraphSpec } from './types';

export interface Pos {
  x: number;
  y: number;
}

export const NODE_W = 158;
export const NODE_H = 70;
const GAP_X = 78;
const GAP_Y = 44;
const PAD = 40;

/**
 * Auto-arranges an architecture left-to-right by "depth from the source".
 *
 * Each node's column = the longest path of edges leading into it, so traffic
 * always flows rightward and the diagram reads like a real architecture sketch.
 * Nodes in the same column are stacked and vertically centred.
 */
export function computeLayout(graph: GraphSpec['scenario']): Record<string, Pos> {
  const ids = graph.components.map((c) => c.id);
  const layer: Record<string, number> = {};
  ids.forEach((id) => (layer[id] = 0));

  // relax longest-path layering (safe for DAGs; capped by node count)
  for (let i = 0; i < ids.length; i++) {
    for (const e of graph.edges) {
      if (layer[e.to] < layer[e.from] + 1) layer[e.to] = layer[e.from] + 1;
    }
  }

  const groups: Record<number, string[]> = {};
  let maxLayer = 0;
  for (const id of ids) {
    const l = layer[id];
    (groups[l] ??= []).push(id);
    maxLayer = Math.max(maxLayer, l);
  }

  const maxCount = Math.max(1, ...Object.values(groups).map((g) => g.length));
  const colHeight = maxCount * (NODE_H + GAP_Y);

  const pos: Record<string, Pos> = {};
  for (let l = 0; l <= maxLayer; l++) {
    const g = groups[l] ?? [];
    const offset = (colHeight - g.length * (NODE_H + GAP_Y)) / 2;
    g.forEach((id, idx) => {
      pos[id] = {
        x: PAD + l * (NODE_W + GAP_X),
        y: PAD + offset + idx * (NODE_H + GAP_Y),
      };
    });
  }
  return pos;
}
