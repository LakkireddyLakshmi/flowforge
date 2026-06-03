import { useEffect, useRef } from 'react';
import type { ComponentType, GraphSpec, Health, SimSnapshot } from '../types';
import { NODE_H, NODE_W, type Pos } from '../layout';

const ICON: Record<ComponentType, string> = {
  source: '👤',
  loadbalancer: '⚖️',
  server: '🖥️',
  cache: '⚡',
  queue: '📥',
  database: '🗄️',
  sink: '🏁',
};

const PARTICLES = 6; // dots rendered per edge; how many are visible scales with load
const FLOW_REF = 12; // per-frame flow count that counts as "fully busy"

/** A smooth S-curve from the right edge of `a` to the left edge of `b`. */
function edgePath(a: Pos, b: Pos): string {
  const sx = a.x + NODE_W;
  const sy = a.y + NODE_H / 2;
  const tx = b.x;
  const ty = b.y + NODE_H / 2;
  const dx = Math.max(40, Math.abs(tx - sx) / 2);
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
}

interface Props {
  graph: GraphSpec['scenario'];
  snapshot: SimSnapshot | null;
  positions: Record<string, Pos>;
  onDrag: (id: string, x: number, y: number) => void;
}

export function Canvas({ graph, snapshot, positions, onDrag }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // dragging a node: tracked on the window so the pointer can leave the box
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!drag.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      onDrag(
        drag.current.id,
        e.clientX - rect.left - drag.current.dx,
        e.clientY - rect.top - drag.current.dy,
      );
    }
    function up() {
      drag.current = null;
      document.body.classList.remove('dragging');
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [onDrag]);

  function startDrag(e: React.PointerEvent, id: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    const p = positions[id];
    if (!rect || !p) return;
    drag.current = { id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y };
    document.body.classList.add('dragging');
    e.preventDefault();
  }

  const metrics = new Map((snapshot?.nodes ?? []).map((n) => [n.id, n]));
  const flowMap = new Map((snapshot?.flows ?? []).map((f) => [`${f.from}|${f.to}`, f.count]));

  // size the canvas to fit every node
  let width = 600;
  let height = 280;
  for (const id in positions) {
    const p = positions[id];
    width = Math.max(width, p.x + NODE_W + 40);
    height = Math.max(height, p.y + NODE_H + 40);
  }

  const edges = graph.edges.filter((e) => positions[e.from] && positions[e.to]);

  return (
    <div className="canvas" ref={containerRef} style={{ width, height }}>
      <svg className="edges-layer" width={width} height={height}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#46557a" />
          </marker>
        </defs>
        {edges.map((e) => {
          const d = edgePath(positions[e.from], positions[e.to]);
          const inten = Math.min(1, (flowMap.get(`${e.from}|${e.to}`) ?? 0) / FLOW_REF);
          return (
            <path
              key={e.id}
              d={d}
              className="edge"
              markerEnd="url(#arrow)"
              style={{ strokeWidth: 1.5 + inten * 3, opacity: 0.3 + inten * 0.55 }}
            />
          );
        })}
      </svg>

      {edges.map((e) => {
        const d = edgePath(positions[e.from], positions[e.to]);
        const inten = Math.min(1, (flowMap.get(`${e.from}|${e.to}`) ?? 0) / FLOW_REF);
        const active = Math.round(inten * PARTICLES);
        return (
          <div className="particles" key={`p-${e.id}`} aria-hidden>
            {Array.from({ length: PARTICLES }).map((_, i) => (
              <span
                key={i}
                className="particle"
                style={
                  {
                    offsetPath: `path('${d}')`,
                    animationDelay: `${-(i / PARTICLES) * 1.6}s`,
                    opacity: i < active ? 0.95 : 0,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        );
      })}

      {graph.components.map((c) => {
        const p = positions[c.id];
        if (!p) return null;
        const m = metrics.get(c.id);
        const health: Health = m?.health ?? 'idle';
        const util = Math.round((m?.utilization ?? 0) * 100);
        return (
          <div
            key={c.id}
            className={`nodebox h-${health}`}
            style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            onPointerDown={(e) => startDrag(e, c.id)}
          >
            <div className="nb-top">
              <span className="nb-icon">{ICON[c.type]}</span>
              <span className="nb-label">{c.label ?? c.id}</span>
            </div>
            <div className="nb-stats">
              {c.type === 'source' ? (
                <span>{Math.round(m?.throughput ?? 0)}/s out</span>
              ) : (
                <>
                  <span>{util}%</span>
                  <span className={(m?.queueDepth ?? 0) > 0 ? 'q-warn' : ''}>
                    q{m?.queueDepth ?? 0}
                  </span>
                  <span>
                    {m?.inFlight ?? 0}/{m?.capacity ?? 0}
                  </span>
                </>
              )}
            </div>
            <div className="nb-progress">
              <div className={`nb-progress-fill health-${health}`} style={{ width: `${util}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
