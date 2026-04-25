import asyncio
import json
import math
import os
import statistics
import threading
import time
from collections import deque
from typing import Any

import serial
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class SerialConfig(BaseModel):
  port: str = os.getenv("SERIAL_PORT", "COM3")
  baud: int = int(os.getenv("SERIAL_BAUD", "115200"))


class CalibrationState(BaseModel):
  running: bool = False
  started_at_ms: int = 0
  duration_ms: int = 3000


class CPRState:
  def __init__(self) -> None:
    self.reset_session()
    self.calibration = CalibrationState()

  def reset_session(self) -> None:
    self.baseline_force = 0.0
    self.max_force = 2500.0
    self.dynamic_threshold = 250.0
    self.last_force = 0.0
    self.in_compression = False
    self.last_compression_ms = -10_000
    self.debounce_ms = 250
    self.compression_count = 0
    self.releases_ok = 0
    self.intervals_ms: deque[float] = deque(maxlen=20)
    self.compression_times_ms: deque[float] = deque(maxlen=30)
    self.force_history: deque[dict[str, float]] = deque(maxlen=300)
    self.last_feedback = "Push harder"
    self.last_metrics: dict[str, Any] = {}

  def start_calibration(self, duration_ms: int = 3000) -> None:
    self.calibration = CalibrationState(
      running=True,
      started_at_ms=int(time.time() * 1000),
      duration_ms=duration_ms,
    )
    self._cal_samples: list[float] = []

  def process_sample(self, sample: dict[str, Any]) -> dict[str, Any]:
    now_ms = float(sample.get("t", time.time() * 1000))
    force = float(sample.get("force", 0.0))

    self.force_history.append({"t": now_ms, "force": force})

    if self.calibration.running:
      self._cal_samples.append(force)
      elapsed = int(time.time() * 1000) - self.calibration.started_at_ms
      if elapsed >= self.calibration.duration_ms:
        self.calibration.running = False
        if self._cal_samples:
          self.baseline_force = float(statistics.fmean(self._cal_samples))
          p95 = sorted(self._cal_samples)[int(len(self._cal_samples) * 0.95)]
          self.max_force = max(self.baseline_force + 800.0, float(p95))
          self.dynamic_threshold = max(70.0, (self.max_force - self.baseline_force) * 0.12)

    force_above_baseline = max(0.0, force - self.baseline_force)
    threshold = self.baseline_force + self.dynamic_threshold

    # Compression detector:
    # 1) Enter compression when force rises above threshold.
    # 2) Count only once force falls back near baseline, with debounce guard.
    if not self.in_compression and force > threshold:
      self.in_compression = True

    release_threshold = self.baseline_force + max(40.0, self.dynamic_threshold * 0.4)
    if self.in_compression and force <= release_threshold:
      if now_ms - self.last_compression_ms >= self.debounce_ms:
        self.compression_count += 1
        if self.last_compression_ms > 0:
          self.intervals_ms.append(now_ms - self.last_compression_ms)
        self.compression_times_ms.append(now_ms)
        self.last_compression_ms = now_ms

        if force <= self.baseline_force + 30.0:
          self.releases_ok += 1
      self.in_compression = False

    recent_cpm = self._compute_rate()
    rhythm_score = self._compute_rhythm_score()
    force_score = self._compute_force_score(force_above_baseline)
    release_ratio = (self.releases_ok / self.compression_count) if self.compression_count > 0 else 1.0

    self.last_feedback = self._feedback_text(
      recent_cpm=recent_cpm,
      force_score=force_score,
      release_ratio=release_ratio,
    )

    metrics = {
      "compressionCount": self.compression_count,
      "compressionRate": recent_cpm,
      "forceLevel": force,
      "forceScore": force_score,
      "rhythmConsistency": rhythm_score,
      "releaseQuality": release_ratio,
      "baselineForce": self.baseline_force,
      "threshold": threshold,
      "feedback": self.last_feedback,
      "calibrating": self.calibration.running,
    }
    self.last_metrics = metrics
    return metrics

  def _compute_rate(self) -> float:
    if len(self.compression_times_ms) < 2:
      return 0.0
    elapsed_ms = self.compression_times_ms[-1] - self.compression_times_ms[0]
    if elapsed_ms <= 0:
      return 0.0
    return (len(self.compression_times_ms) - 1) * 60_000.0 / elapsed_ms

  def _compute_rhythm_score(self) -> float:
    if len(self.intervals_ms) < 3:
      return 1.0
    mean_interval = statistics.fmean(self.intervals_ms)
    if mean_interval <= 0:
      return 0.0
    std_dev = statistics.pstdev(self.intervals_ms)
    cv = std_dev / mean_interval
    return max(0.0, min(1.0, 1.0 - cv))

  def _compute_force_score(self, force_above_baseline: float) -> float:
    span = max(200.0, self.max_force - self.baseline_force)
    return max(0.0, min(1.0, force_above_baseline / span))

  def _feedback_text(self, recent_cpm: float, force_score: float, release_ratio: float) -> str:
    if release_ratio < 0.8:
      return "Release fully"
    if force_score < 0.25:
      return "Push harder"
    if recent_cpm < 100 and recent_cpm > 0:
      return "Too slow"
    if recent_cpm > 120:
      return "Too fast"
    if 100 <= recent_cpm <= 120:
      return "Good rate"
    return "Push harder"


class ConnectionManager:
  def __init__(self) -> None:
    self.clients: set[WebSocket] = set()

  async def connect(self, websocket: WebSocket) -> None:
    await websocket.accept()
    self.clients.add(websocket)

  def disconnect(self, websocket: WebSocket) -> None:
    self.clients.discard(websocket)

  async def broadcast(self, payload: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for client in self.clients:
      try:
        await client.send_json(payload)
      except Exception:
        dead.append(client)
    for ws in dead:
      self.disconnect(ws)


app = FastAPI(title="CPR Trainer Backend")
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

serial_cfg = SerialConfig()
state = CPRState()
manager = ConnectionManager()
loop: asyncio.AbstractEventLoop | None = None


def serial_reader_thread() -> None:
  global loop
  while True:
    try:
      with serial.Serial(serial_cfg.port, serial_cfg.baud, timeout=1) as ser:
        print(f"Connected to {serial_cfg.port} @ {serial_cfg.baud}")
        while True:
          line = ser.readline().decode("utf-8", errors="ignore").strip()
          if not line:
            continue
          try:
            sample = json.loads(line)
            if not isinstance(sample, dict):
              continue
          except json.JSONDecodeError:
            continue

          if "force" not in sample:
            continue

          metrics = state.process_sample(sample)
          payload = {
            "sample": {
              "t": sample.get("t"),
              "force": sample.get("force"),
              "ax": sample.get("ax"),
              "ay": sample.get("ay"),
              "az": sample.get("az"),
            },
            "metrics": metrics,
          }
          if loop and not loop.is_closed():
            asyncio.run_coroutine_threadsafe(manager.broadcast(payload), loop)
    except serial.SerialException as exc:
      print(f"Serial error: {exc}. Retrying in 2s.")
      time.sleep(2)
    except Exception as exc:
      print(f"Unexpected serial thread error: {exc}. Retrying in 2s.")
      time.sleep(2)


@app.on_event("startup")
async def startup() -> None:
  global loop
  loop = asyncio.get_running_loop()
  threading.Thread(target=serial_reader_thread, daemon=True).start()


@app.get("/health")
async def health() -> dict[str, Any]:
  return {"ok": True, "serialPort": serial_cfg.port}


@app.post("/calibrate")
async def calibrate() -> dict[str, Any]:
  state.start_calibration()
  return {"ok": True, "calibrating": True, "durationMs": state.calibration.duration_ms}


@app.post("/session/reset")
async def reset_session() -> dict[str, Any]:
  baseline = state.baseline_force
  state.reset_session()
  state.baseline_force = baseline
  return {"ok": True}


@app.post("/session/start")
async def start_session() -> dict[str, Any]:
  return await reset_session()


@app.websocket("/ws")
async def ws_stream(websocket: WebSocket) -> None:
  await manager.connect(websocket)
  try:
    while True:
      # Keep the socket alive; frontend can send pings if needed.
      _ = await websocket.receive_text()
  except WebSocketDisconnect:
    manager.disconnect(websocket)
  except Exception:
    manager.disconnect(websocket)

