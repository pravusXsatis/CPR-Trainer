import { useEffect, useMemo, useState } from "react";

const DEVICE_URL = "http://192.168.4.1";
const MAX_FORCE_POINTS = 100;

const EMPTY_DATA = {
  forceRaw: 0,
  forceCorrected: 0,
  accelXCorrected: 0,
  accelYCorrected: 0,
  accelZCorrected: 0,
  compressionCount: 0,
  compressionRate: 0,
  feedback: "Start compressions",
};

function MetricCard({ title, value, unit = "" }) {
  return (
    <article className="metric-card">
      <p className="metric-title">{title}</p>
      <p className="metric-value">
        {value}
        {unit}
      </p>
    </article>
  );
}

function ForceGraph({ points }) {
  if (points.length < 2) {
    return <p className="graph-empty">Waiting for live force data...</p>;
  }

  const maxValue = Math.max(...points);
  const minValue = Math.min(...points);
  const range = Math.max(maxValue - minValue, 1);

  const polyline = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((value - minValue) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="force-graph" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Force graph">
      <polyline points={polyline} fill="none" stroke="#4ed7ff" strokeWidth="2" />
    </svg>
  );
}

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [sensorData, setSensorData] = useState(EMPTY_DATA);
  const [forcePoints, setForcePoints] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function pollData() {
      try {
        const response = await fetch(`${DEVICE_URL}/data`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        setSensorData({
          forceRaw: Number(data.forceRaw ?? 0),
          forceCorrected: Number(data.forceCorrected ?? 0),
          accelXCorrected: Number(data.accelXCorrected ?? 0),
          accelYCorrected: Number(data.accelYCorrected ?? 0),
          accelZCorrected: Number(data.accelZCorrected ?? 0),
          compressionCount: Number(data.compressionCount ?? 0),
          compressionRate: Number(data.compressionRate ?? 0),
          feedback: String(data.feedback ?? "Start compressions"),
        });

        setForcePoints((prev) => [...prev, Number(data.forceCorrected ?? 0)].slice(-MAX_FORCE_POINTS));
        setIsConnected(true);
      } catch (error) {
        if (isMounted) {
          setIsConnected(false);
        }
      }
    }

    pollData();
    const intervalId = window.setInterval(pollData, 50);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const feedbackMessage = useMemo(() => {
    const allowed = new Set(["Too slow", "Good rate", "Too fast", "Start compressions"]);
    return allowed.has(sensorData.feedback) ? sensorData.feedback : "Start compressions";
  }, [sensorData.feedback]);

  async function calibrate() {
    try {
      setIsCalibrating(true);
      await fetch(`${DEVICE_URL}/calibrate`, { method: "GET", cache: "no-store" });
    } finally {
      setIsCalibrating(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>CPR Trainer Dashboard</h1>
        <span className={isConnected ? "status connected" : "status disconnected"}>
          {isConnected ? "Connected" : "Connect to CPR_Trainer Wi-Fi"}
        </span>
      </header>

      <section className="actions">
        <button type="button" onClick={calibrate} disabled={isCalibrating}>
          {isCalibrating ? "Calibrating..." : "Calibrate"}
        </button>
      </section>

      {!isConnected && <p className="error-banner">Connect to CPR_Trainer Wi-Fi</p>}

      <section className="feedback-card">
        <p className="feedback-label">Live Feedback</p>
        <p className="feedback-message">{feedbackMessage}</p>
      </section>

      <section className="metrics-grid">
        <MetricCard title="Force Corrected" value={sensorData.forceCorrected} />
        <MetricCard title="Force Raw" value={sensorData.forceRaw} />
        <MetricCard title="Accel X Corrected" value={sensorData.accelXCorrected} />
        <MetricCard title="Accel Y Corrected" value={sensorData.accelYCorrected} />
        <MetricCard title="Accel Z Corrected" value={sensorData.accelZCorrected} />
        <MetricCard title="Compression Count" value={sensorData.compressionCount} />
        <MetricCard title="Compression Rate" value={sensorData.compressionRate.toFixed(1)} unit=" CPM" />
      </section>

      <section className="graph-card">
        <div className="graph-head">
          <h2>Force Corrected (Last 100 readings)</h2>
        </div>
        <div className="graph-wrap">
          <ForceGraph points={forcePoints} />
        </div>
      </section>
    </main>
  );
}
