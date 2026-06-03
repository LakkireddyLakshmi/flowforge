import { useEffect, useRef, useState } from 'react';
import type { EditGraph } from '../types';
import { ICON } from '../editorTypes';
import { NODE_H, NODE_W, type Pos } from '../layout';

function edgePath(a: Pos, b: Pos): string {
  const sx = a.x + NODE_W;
  const sy = a.y + NODE_H / 2;
  const tx = b.x;
  const ty = b.y + NODE_H / 2;
  const dx = Math.max(40, Math.abs(tx - sx) / 2);
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
}

export interface Sel {
  kind: 'node' | 'edge';
  id: string;
}

interface Props {
  graph: EditGraph;
  positions: Record<string, Pos>;
  selected: Sel | null;
  linking: string | null;
  onDrag: (id: string, x: number, y: number) => void;
  onSelect: (s: Sel | null) => void;
  onSetLink: (id: string | null) => void;
  onAddEdge: (from: string, to: string) => void;
}

/**
 * The architecture editor. Same node/edge visuals as the run canvas, but with
 * connection ports, selection, and drag. Connecting: press a node's right-hand
 * port, then click the target node. Click empty space to deselect / cancel.
 */
export function EditorCanvas({
  graph,
  positions,
  selected,
  linking,
  onDrag,
  onSelect,
  onSetLink,
  onAddEdge,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [cursor, setCursor] = useState<Pos | null>(null);

  useEffect(() => {
    function move(e: PointerEvent) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (drag.current) onDrag(drag.current.id, x - drag.current.dx, y - drag.current.dy);
      if (linking) setCursor({ x, y });
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
  }, [onDrag, linking]);

  useEffect(() => {
    if (!linking) setCursor(null);
  }, [linking]);

  function startDrag(e: React.PointerEvent, id: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    const p = positions[id];
    if (!rect || !p) return;
    drag.current = { id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y };
    document.body.classList.add('dragging');
    onSelect({ kind: 'node', id });
    e.preventDefault();
  }

  function onNodeDown(e: React.PointerEvent, id: string) {
    if (linking) {
      e.stopPropagation();
      if (linking !== id) onAddEdge(linking, id);
      onSetLink(null);
    } else {
      startDrag(e, id);
    }
  }

  let width = 640;
  let height = 340;
  for (const id in positions) {
    const p = positions[id];
    width = Math.max(width, p.x + NODE_W + 40);
    height = Math.max(height, p.y + NODE_H + 40);
  }

  const edges = graph.edges.filter((e) => positions[e.from] && positions[e.to]);
  const linkSrc = linking ? positions[linking] : null;

  return (
    <div
      className="canvas editor"
      ref={containerRef}
      style={{ width, height }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          if (linking) onSetLink(null);
          else onSelect(null);
        }
      }}
    >
      <svg className="edges-layer" width={width} height={height}>
        <defs>
          <marker id="arrow-e" markerWidth="10" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#46557a" />
          </marker>
        </defs>
        {edges.map((e) => {
          const sel = selected?.kind === 'edge' && selected.id === e.id;
          return (
            <path
              key={e.id}
              d={edgePath(positions[e.from], positions[e.to])}
              className={`edge editable ${sel ? 'sel' : ''}`}
              markerEnd="url(#arrow-e)"
              onPointerDown={(ev) => {
                ev.stopPropagation();
                onSelect({ kind: 'edge', id: e.id });
              }}
            />
          );
        })}
        {linkSrc && cursor && (
          <path
            d={`M ${linkSrc.x + NODE_W} ${linkSrc.y + NODE_H / 2} L ${cursor.x} ${cursor.y}`}
            className="edge linking-line"
          />
        )}
      </svg>

      {graph.components.map((c) => {
        const p = positions[c.id];
        if (!p) return null;
        const sel = selected?.kind === 'node' && selected.id === c.id;
        return (
          <div
            key={c.id}
            className={`nodebox editable ${sel ? 'sel' : ''} ${linking && linking !== c.id ? 'link-target' : ''}`}
            style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            onPointerDown={(e) => onNodeDown(e, c.id)}
          >
            <div className="nb-top">
              <span className="nb-icon">{ICON[c.type]}</span>
              <span className="nb-label">{c.label ?? c.id}</span>
            </div>
            <div className="nb-type-line">{c.type}</div>
            {c.type !== 'source' && <span className="port port-in" />}
            {c.type !== 'sink' && (
              <span
                className="port port-out"
                title="Press, then click a target to connect"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSetLink(c.id);
                  onSelect({ kind: 'node', id: c.id });
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
