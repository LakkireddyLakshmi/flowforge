import { useEffect, useRef, useState } from 'react';
import { useSimulation } from './useSimulation';
import { Canvas } from './components/Canvas';
import { EditorCanvas, type Sel } from './components/EditorCanvas';
import { PropsPanel } from './components/PropsPanel';
import { LatencyChart } from './components/LatencyChart';
import { computeLayout, type Pos } from './layout';
import { DEFAULTS, ICON, PALETTE, labelFor } from './editorTypes';
import type { ComponentSpec, ComponentType, EditGraph } from './types';

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const { status, snapshot, graph, controls } = useSimulation();

  const [mode, setMode] = useState<'run' | 'edit'>('run');
  const [paused, setPaused] = useState(false);
  const [load, setLoad] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState('webStack');
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [history, setHistory] = useState<{ p50: number; p99: number }[]>([]);
  const lastTime = useRef(0);

  // editor state
  const [edit, setEdit] = useState<EditGraph>({ components: [], edges: [] });
  const [selected, setSelected] = useState<Sel | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const idc = useRef(1);

  // (re)layout when the running architecture changes — but KEEP positions we
  // already have, so manual drags and editor placements survive a re-run
  useEffect(() => {
    if (!graph) return;
    setPositions((prev) => {
      const layout = computeLayout(graph.scenario);
      const next: Record<string, Pos> = {};
      for (const c of graph.scenario.components) next[c.id] = prev[c.id] ?? layout[c.id];
      return next;
    });
  }, [graph]);

  // rolling latency window for the chart; clears when the sim resets
  useEffect(() => {
    if (!snapshot || mode === 'edit') return;
    setHistory((h) => {
      const reset = h.length > 0 && snapshot.time < lastTime.current;
      lastTime.current = snapshot.time;
      const base = reset ? [] : h;
      return [...base, { p50: snapshot.latency.p50, p99: snapshot.latency.p99 }].slice(-60);
    });
  }, [snapshot, mode]);

  // delete / cancel keys while editing
  useEffect(() => {
    if (mode !== 'edit') return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        setLinking(null);
        setSelected(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected]);

  // ── run-mode controls ──────────────────────────────────────────────
  const togglePlay = () => {
    if (paused) controls.resume();
    else controls.pause();
    setPaused(!paused);
  };
  const onLoad = (v: number) => {
    setLoad(v);
    controls.setLoad(v);
  };
  const onSpeed = (v: number) => {
    setSpeed(v);
    controls.setSpeed(v);
  };
  const onScenario = (name: string) => {
    setScenario(name);
    controls.setScenario(name);
    setPaused(false);
  };
  const onDrag = (id: string, x: number, y: number) =>
    setPositions((p) => ({ ...p, [id]: { x: Math.max(0, x), y: Math.max(0, y) } }));

  // ── editor actions ─────────────────────────────────────────────────
  const enterEdit = () => {
    if (graph) {
      setEdit({
        components: graph.scenario.components.map((c) => ({ ...c })),
        edges: graph.scenario.edges.map((e) => ({ ...e })),
      });
    }
    controls.pause();
    setPaused(true);
    setSelected(null);
    setLinking(null);
    setMode('edit');
  };

  const cancelEdit = () => {
    setMode('run');
    setSelected(null);
    setLinking(null);
    controls.resume();
    setPaused(false);
  };

  const applyEdit = () => {
    controls.runCustom(edit);
    setMode('run');
    setSelected(null);
    setLinking(null);
    setHistory([]);
    setPaused(false);
  };

  const addNode = (type: ComponentType) => {
    const id = `${type}-${idc.current++}`;
    const node: ComponentSpec = { id, type, label: labelFor(type), ...DEFAULTS[type] };
    setEdit((g) => ({ ...g, components: [...g.components, node] }));
    setPositions((p) => ({ ...p, [id]: { x: 60, y: 60 + (Object.keys(p).length % 6) * 38 } }));
    setSelected({ kind: 'node', id });
  };

  const updateNode = (id: string, patch: Partial<ComponentSpec>) =>
    setEdit((g) => ({
      ...g,
      components: g.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const addEdge = (from: string, to: string) =>
    setEdit((g) =>
      g.edges.some((e) => e.from === from && e.to === to)
        ? g
        : { ...g, edges: [...g.edges, { id: `edge-${idc.current++}`, from, to }] },
    );

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === 'node') {
      const id = selected.id;
      setEdit((g) => ({
        components: g.components.filter((c) => c.id !== id),
        edges: g.edges.filter((e) => e.from !== id && e.to !== id),
      }));
    } else {
      const id = selected.id;
      setEdit((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
    }
    setSelected(null);
  };

  const selectedNode =
    selected?.kind === 'node' ? edit.components.find((c) => c.id === selected.id) ?? null : null;

  const lat = snapshot?.latency;
  const dropping = (snapshot?.dropped ?? 0) > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⚡</span>
          <div>
            <h1>FlowForge</h1>
            <p className="tagline">Draw an architecture. Press play. Watch it break.</p>
          </div>
        </div>
        <div className={`status ${status === 'live' ? 'on' : status === 'reconnecting' ? 'warn' : 'off'}`}>
          <span className="dot" />
          {status === 'live' ? 'Engine live' : status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
        </div>
      </header>

      {mode === 'run' ? (
        <div className="controls">
          <label className="ctrl">
            <span>Architecture</span>
            <select value={scenario} onChange={(e) => onScenario(e.target.value)}>
              {(graph?.available ?? ['webStack']).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={togglePlay}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn" onClick={() => { controls.reset(); setHistory([]); setPaused(false); }}>
            ↻ Reset
          </button>
          <button className="btn edit" onClick={enterEdit}>
            ✏️ Edit architecture
          </button>
          <label className="ctrl slider">
            <span>Load <strong>×{load.toFixed(1)}</strong></span>
            <input type="range" min={0} max={8} step={0.5} value={load} onChange={(e) => onLoad(Number(e.target.value))} />
          </label>
          <label className="ctrl slider">
            <span>Speed <strong>×{speed.toFixed(2)}</strong></span>
            <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => onSpeed(Number(e.target.value))} />
          </label>
        </div>
      ) : (
        <div className="controls edit-controls">
          <span className="palette-label">Add:</span>
          {PALETTE.map((p) => (
            <button key={p.type} className="chip" onClick={() => addNode(p.type)}>
              {ICON[p.type]} {p.label}
            </button>
          ))}
          <div className="spacer" />
          <button className="btn primary" onClick={applyEdit}>
            ▶ Apply &amp; Run
          </button>
          <button className="btn" onClick={cancelEdit}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'run' ? (
        <>
          <main className="stage-canvas">
            {graph ? (
              <Canvas graph={graph.scenario} snapshot={snapshot} positions={positions} onDrag={onDrag} />
            ) : (
              <div className="waking">Waking the engine…</div>
            )}
          </main>
          <footer className="bottom">
            <div className="bottom-stats">
              <Stat label="Throughput" value={fmt(snapshot?.throughput ?? 0)} unit="/s" />
              <Stat label="p99" value={fmt(lat?.p99 ?? 0)} unit="ms" tone={(lat?.p99 ?? 0) > 500 ? 'bad' : ''} />
              <Stat label="In flight" value={fmt(snapshot?.inFlight ?? 0)} />
              <Stat label="Completed" value={fmt(snapshot?.completed ?? 0)} tone="good" />
              <Stat label="Dropped" value={fmt(snapshot?.dropped ?? 0)} tone={dropping ? 'bad' : ''} />
            </div>
            <LatencyChart history={history} />
          </footer>
        </>
      ) : (
        <main className="editor-stage">
          <div className="stage-canvas">
            <EditorCanvas
              graph={edit}
              positions={positions}
              selected={selected}
              linking={linking}
              onDrag={onDrag}
              onSelect={setSelected}
              onSetLink={setLinking}
              onAddEdge={addEdge}
            />
          </div>
          <PropsPanel
            node={selectedNode}
            onChange={(patch) => selected && updateNode(selected.id, patch)}
            onDelete={deleteSelected}
          />
        </main>
      )}
    </div>
  );
}
