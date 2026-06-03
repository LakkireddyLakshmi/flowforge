interface Point {
  p50: number;
  p99: number;
}

/** A compact rolling area-chart of p50 / p99 latency over the recent frames. */
export function LatencyChart({ history }: { history: Point[] }) {
  const W = 560;
  const H = 130;
  const PAD = 8;
  const n = history.length;
  const max = Math.max(20, ...history.map((h) => h.p99)) * 1.15;

  const x = (i: number) => (n <= 1 ? PAD : PAD + (i / (n - 1)) * (W - 2 * PAD));
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);

  const toLine = (key: keyof Point) =>
    history.map((h, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(h[key]).toFixed(1)}`).join(' ');

  const area =
    n > 1 ? `${toLine('p99')} L ${x(n - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z` : '';

  const current = history[n - 1];

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="chart-title">Latency</span>
        <span className="chart-legend">
          <span className="lg lg-p50">p50 {Math.round(current?.p50 ?? 0)}ms</span>
          <span className="lg lg-p99">p99 {Math.round(current?.p99 ?? 0)}ms</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="p99fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill="url(#p99fill)" />}
        {n > 1 && <path d={toLine('p99')} className="line-p99" />}
        {n > 1 && <path d={toLine('p50')} className="line-p50" />}
      </svg>
    </div>
  );
}
