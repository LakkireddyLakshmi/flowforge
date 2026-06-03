import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import type { ConnStatus, EditGraph, GraphSpec, SimSnapshot } from './types';

/**
 * Owns the live link to the engine: connection status, the latest snapshot, the
 * current graph, and the control commands. Socket.IO auto-reconnects, so if the
 * engine drops we flip to "reconnecting" and the stream simply resumes when it's
 * back — no page refresh, no lost session.
 */
export function useSimulation() {
  const [status, setStatus] = useState<ConnStatus>(socket.connected ? 'live' : 'connecting');
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [graph, setGraph] = useState<GraphSpec | null>(null);
  const everConnected = useRef(socket.connected);

  useEffect(() => {
    function onConnect() {
      everConnected.current = true;
      setStatus('live');
    }
    function onDisconnect() {
      setStatus('reconnecting');
    }
    function onSnapshot(s: SimSnapshot) {
      setSnapshot(s);
    }
    function onGraph(g: GraphSpec) {
      setGraph(g);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('sim:snapshot', onSnapshot);
    socket.on('sim:graph', onGraph);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sim:snapshot', onSnapshot);
      socket.off('sim:graph', onGraph);
    };
  }, []);

  const controls = {
    setLoad: (m: number) => socket.emit('sim:load', m),
    setSpeed: (s: number) => socket.emit('sim:speed', s),
    pause: () => socket.emit('sim:pause'),
    resume: () => socket.emit('sim:resume'),
    reset: () => socket.emit('sim:reset'),
    setScenario: (name: string) => socket.emit('sim:scenario', name),
    runCustom: (graph: EditGraph) => socket.emit('sim:custom', graph),
  };

  return { status, snapshot, graph, controls };
}
