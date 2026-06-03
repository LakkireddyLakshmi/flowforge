import { useState } from 'react';
import { useSimulation } from './useSimulation';
import type { ComponentType, NodeMetrics } from './types';

const TYPE_ICON: Record<ComponentType, string> = {
  source: '👤',
  loadbalancer: '⚖️',
  server: '🖥️',
  cache: '⚡',
  queue: '📥',
  database: '🗄️',
  sink: '🏁',
};

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

function StatCard({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
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

function NodeRow({ node }: { node: NodeMetrics }) {
  const pct = Math.round(node.utilization * 100);
  return (
    <div className="node-row">
      <div className="node-id">
        <span className="node-icon">{TYPE_ICON[node.type]}</span>
        <div>
          <div className="node-label">{node.label}</div>
          <div className="node-type">{node.type}</div>
        </div>
      </div>
      <div className="node-bar-wrap">
        <div className="node-bar-track">
          <div className={`node-bar-fill health-${node.health}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="node-bar-meta">
          <span>{pct}% util</span>
          <span>{node.type === 'source' ? '—' : `${node.inFlight}/${node.capacity} busy`}</span>
          <span className={node.queueDepth > 0 ? 'warn' : ''}>queue {fmt(node.queueDepth)}</span>
          <span>{fmt(node.throughput)}/s</span>
        </div>
      </div>
      <div className={`node-health health-${node.health}`}>{node.health}</div>
    </div>
  );
}

export default function App() {
  const { status, snapshot, graph, controls } = useSimulation();
  const [paused, setPaused] = useState(false);
  const [load, setLoad] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState('webStack');

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
        <button className="btn" onClick={() => { controls.reset(); setPaused(false); }}>
          ↻ Reset
        </button>

        <label className="ctrl slider">
          <span>
            Load <strong>×{load.toFixed(1)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={load}
            onChange={(e) => onLoad(Number(e.target.value))}
          />
        </label>

        <label className="ctrl slider">
          <span>
            Speed <strong>×{speed.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
          />
        </label>
      </div>

      <main className="dashboard">
        <section className="stat-grid">
          <StatCard label="Throughput" value={fmt(snapshot?.throughput ?? 0)} unit="/s" />
          <StatCard label="p99 latency" value={fmt(lat?.p99 ?? 0)} unit="ms" tone={(lat?.p99 ?? 0) > 500 ? 'bad' : ''} />
          <StatCard label="p50 latency" value={fmt(lat?.p50 ?? 0)} unit="ms" />
          <StatCard label="In flight" value={fmt(snapshot?.inFlight ?? 0)} />
          <StatCard label="Completed" value={fmt(snapshot?.completed ?? 0)} tone="good" />
          <StatCard label="Dropped" value={fmt(snapshot?.dropped ?? 0)} tone={dropping ? 'bad' : ''} />
          <StatCard label="Failed" value={fmt(snapshot?.failed ?? 0)} />
          <StatCard label="Sim clock" value={fmt((snapshot?.time ?? 0) / 1000, 1)} unit="s" />
        </section>

        <section className="nodes">
          <h2>Components</h2>
          {snapshot ? (
            snapshot.nodes.map((n) => <NodeRow key={n.id} node={n} />)
          ) : (
            <p className="empty">Waking the engine…</p>
          )}
        </section>

        <p className="hint">
          Step 3 — real simulation metrics are streaming live over a WebSocket.
          Drag the <strong>Load</strong> slider up and watch the bottleneck's
          queue grow and p99 climb. Next step turns this into a drag-and-drop
          canvas.
        </p>
      </main>
    </div>
  );
}
