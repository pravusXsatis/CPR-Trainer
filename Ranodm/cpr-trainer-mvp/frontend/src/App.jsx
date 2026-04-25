import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

const WS_URL = "ws://localhost:8000/ws";
const API_URL = "http://localhost:8000";

function MetricCard({ title, value, unit = "" }) {
  return (
    <div className="metric-card">
      <p className="metric-title">{title}</p>
      <p className="metric-value">
        {value}
        {unit}
      </p>
    </div>
  );
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [feedback, setFeedback] = useState("Waiting for data...");
  const [forceSeries, setForceSeries] = useState([]);
  const [metrics, setMetrics] = useState({
    compressionRate: 0,
    compressionCount: 0,
    forceLevel: 0,
    rhythmConsistency: 1,
    releaseQuality: 1,
    calibrating: false,
  });
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send("hello");
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload?.sample || !payload?.metrics) {
          return;
        }
        setMetrics(payload.metrics);
        setFeedback(payload.metrics.feedback ?? "Keep compressing");

        setForceSeries((prev) => {
          const next = [...prev, { t: payload.sample.t ?? Date.now(), force: payload.sample.force ?? 0 }];
          return next.slice(-120);
        });
      } catch (e) {
        // Ignore malformed websocket frames.
      }
    };

    return () => ws.close();
  }, []);

  const formattedRate = useMemo(() => metrics.compressionRate.toFixed(1), [metrics.compressionRate]);
  const formattedForce = useMemo(() => Number(metrics.forceLevel || 0).toFixed(0), [metrics.forceLevel]);
  const rhythmPct = useMemo(() => `${Math.round((metrics.rhythmConsistency || 0) * 100)}%`, [metrics.rhythmConsistency]);
  const releasePct = useMemo(() => `${Math.round((metrics.releaseQuality || 0) * 100)}%`, [metrics.releaseQuality]);

  async function post(path) {
    await fetch(`${API_URL}${path}`, { method: "POST" });
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>Portable CPR Trainer</h1>
        <span className={connected ? "status connected" : "status disconnected"}>
          {connected ? "Live" : "Disconnected"}
        </span>
      </header>

      <section className="controls">
        <button onClick={() => post("/session/start")}>Start Session</button>
        <button onClick={() => post("/session/reset")}>Reset Session</button>
        <button onClick={() => post("/calibrate")}>Calibrate Baseline</button>
      </section>

      <section className="metrics-grid">
        <MetricCard title="Compression Rate" value={formattedRate} unit=" CPM" />
        <MetricCard title="Compression Count" value={metrics.compressionCount} />
        <MetricCard title="Force Level" value={formattedForce} />
        <MetricCard title="Rhythm Consistency" value={rhythmPct} />
        <MetricCard title="Release Quality" value={releasePct} />
      </section>

      <section className="feedback">
        <h2>Feedback</h2>
        <p>{metrics.calibrating ? "Calibrating baseline..." : feedback}</p>
      </section>

      <section className="chart-card">
        <h2>Live Force Graph</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forceSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243447" />
              <XAxis
                dataKey="t"
                tick={{ fill: "#b8c9dd", fontSize: 12 }}
                tickFormatter={(t) => `${Math.round((t % 60000) / 1000)}s`}
              />
              <YAxis tick={{ fill: "#b8c9dd", fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="force" stroke="#39d0ff" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
