import { useEffect, useRef, useState } from 'react';
import { useSimulation } from './useSimulation';
import { Canvas } from './components/Canvas';
import { LatencyChart } from './components/LatencyChart';
import { computeLayout, type Pos } from './layout';

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
  const [paused, setPaused] = useState(false);
  const [load, setLoad] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState('webStack');
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [history, setHistory] = useState<{ p50: number; p99: number }[]>([]);
  const lastTime = useRef(0);

  // (re)compute the graph layout whenever the architecture changes
  useEffect(() => {
    if (graph) setPositions(computeLayout(graph.scenario));
  }, [graph]);

  // keep a rolling window of latency for the chart; clear it when the sim resets
  useEffect(() => {
    if (!snapshot) return;
    setHistory((h) => {
      const reset = h.length > 0 && snapshot.time < lastTime.current;
      lastTime.current = snapshot.time;
      const base = reset ? [] : h;
      return [...base, { p50: snapshot.latency.p50, p99: snapshot.latency.p99 }].slice(-60);
    });
  }, [snapshot]);

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
        <button
          className="btn"
          onClick={() => {
            controls.reset();
            setPaused(false);
          }}
        >
          ↻ Reset
        </button>
        <label className="ctrl slider">
          <span>
            Load <strong>×{load.toFixed(1)}</strong>
          </span>
          <input type="range" min={0} max={8} step={0.5} value={load} onChange={(e) => onLoad(Number(e.target.value))} />
        </label>
        <label className="ctrl slider">
          <span>
            Speed <strong>×{speed.toFixed(2)}</strong>
          </span>
          <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => onSpeed(Number(e.target.value))} />
        </label>
      </div>

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
    </div>
  );
}
