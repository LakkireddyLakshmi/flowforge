import { useEffect, useState } from 'react';
import { socket } from './socket';

type Heartbeat = { tick: number; load: number; at: number };

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [beat, setBeat] = useState<Heartbeat | null>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onHeartbeat(hb: Heartbeat) {
      setBeat(hb);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('engine:heartbeat', onHeartbeat);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('engine:heartbeat', onHeartbeat);
    };
  }, []);

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
        <div className={`status ${connected ? 'on' : 'off'}`}>
          <span className="dot" />
          {connected ? 'Engine connected' : 'Engine offline'}
        </div>
      </header>

      <main className="stage">
        <div className="card">
          <span className="step-chip">Step 1</span>
          <h2>The live pipe is open</h2>
          <p>
            The React canvas and the simulation engine are talking to each other
            over a WebSocket. Right now the engine just sends a heartbeat once a
            second — in the next steps this becomes real traffic flowing through
            the architecture you draw.
          </p>

          <div className="gauge">
            <div className="gauge-head">
              <span className="gauge-label">engine heartbeat</span>
              <span className="gauge-tick">#{beat ? beat.tick : '—'}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${beat ? beat.load : 0}%` }}
              />
            </div>
            <div className="gauge-sub">
              simulated load: <strong>{beat ? `${beat.load}%` : 'waiting…'}</strong>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
