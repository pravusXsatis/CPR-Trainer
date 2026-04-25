const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  randomness: document.getElementById("randomness"),
  gravity: document.getElementById("gravity"),
  trailLength: document.getElementById("trailLength"),
  damping: document.getElementById("damping"),
  toggleRun: document.getElementById("toggleRun"),
  shuffle: document.getElementById("shuffle"),
  clearTrail: document.getElementById("clearTrail"),
  energy: document.getElementById("energyReadout"),
  trace: document.getElementById("traceReadout"),
};

const state = {
  running: true,
  origin: { x: 0, y: 0 },
  l1: 170,
  l2: 170,
  m1: 18,
  m2: 18,
  a1: Math.PI * 0.72,
  a2: Math.PI * 0.98,
  v1: 0,
  v2: 0,
  trail: [],
  lastImpulse: 0,
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.origin.x = rect.width * 0.5;
  state.origin.y = Math.max(92, rect.height * 0.22);
  const base = Math.min(rect.width, rect.height);
  state.l1 = Math.max(92, base * 0.24);
  state.l2 = Math.max(92, base * 0.24);
}

function bobPositions() {
  const x1 = state.origin.x + state.l1 * Math.sin(state.a1);
  const y1 = state.origin.y + state.l1 * Math.cos(state.a1);
  const x2 = x1 + state.l2 * Math.sin(state.a2);
  const y2 = y1 + state.l2 * Math.cos(state.a2);
  return { x1, y1, x2, y2 };
}

function stepPhysics(dt) {
  const g = Number(controls.gravity.value);
  const m1 = state.m1;
  const m2 = state.m2;
  const l1 = state.l1;
  const l2 = state.l2;
  const a1 = state.a1;
  const a2 = state.a2;
  const v1 = state.v1;
  const v2 = state.v2;

  const n1 = -g * (2 * m1 + m2) * Math.sin(a1);
  const n2 = -m2 * g * Math.sin(a1 - 2 * a2);
  const n3 = -2 * Math.sin(a1 - a2) * m2;
  const n4 = v2 * v2 * l2 + v1 * v1 * l1 * Math.cos(a1 - a2);
  const d1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * a1 - 2 * a2));
  const a1Accel = (n1 + n2 + n3 * n4) / d1;

  const n5 = 2 * Math.sin(a1 - a2);
  const n6 = v1 * v1 * l1 * (m1 + m2);
  const n7 = g * (m1 + m2) * Math.cos(a1);
  const n8 = v2 * v2 * l2 * m2 * Math.cos(a1 - a2);
  const d2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * a1 - 2 * a2));
  const a2Accel = (n5 * (n6 + n7 + n8)) / d2;

  state.v1 += a1Accel * dt * 62;
  state.v2 += a2Accel * dt * 62;

  const random = Number(controls.randomness.value);
  state.lastImpulse += dt;
  if (random > 0 && state.lastImpulse > 0.08) {
    state.v1 += (Math.random() - 0.5) * random * 0.018;
    state.v2 += (Math.random() - 0.5) * random * 0.03;
    state.lastImpulse = 0;
  }

  const damping = Number(controls.damping.value);
  state.v1 *= damping;
  state.v2 *= damping;
  state.a1 += state.v1 * dt * 62;
  state.a2 += state.v2 * dt * 62;

  const p = bobPositions();
  state.trail.push({ x: p.x2, y: p.y2, hue: (performance.now() * 0.018) % 360 });
  const maxTrail = Number(controls.trailLength.value);
  if (state.trail.length > maxTrail) {
    state.trail.splice(0, state.trail.length - maxTrail);
  }
}

function drawTrail() {
  if (state.trail.length < 2) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < state.trail.length; i += 1) {
    const prev = state.trail[i - 1];
    const point = state.trail[i];
    const alpha = i / state.trail.length;
    ctx.strokeStyle = `hsla(${point.hue}, 82%, 62%, ${alpha * 0.72})`;
    ctx.lineWidth = 1 + alpha * 3.8;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

function drawPendulum() {
  const { x1, y1, x2, y2 } = bobPositions();

  ctx.strokeStyle = "rgba(243, 245, 241, 0.82)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(state.origin.x, state.origin.y);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  drawBob(state.origin.x, state.origin.y, 6, "#f3f5f1");
  drawBob(x1, y1, state.m1, "#46d6c9");
  drawBob(x2, y2, state.m2, "#ffcf5a");
}

function drawBob(x, y, r, color) {
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function estimateEnergy() {
  const y1 = -state.l1 * Math.cos(state.a1);
  const y2 = y1 - state.l2 * Math.cos(state.a2);
  const kinetic = Math.abs(state.v1) * state.l1 + Math.abs(state.v2) * state.l2;
  const potential = Math.abs(y1 + y2) * Number(controls.gravity.value) * 0.02;
  return kinetic + potential;
}

function render() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  drawTrail();
  drawPendulum();
  controls.energy.textContent = estimateEnergy().toFixed(2);
  controls.trace.textContent = String(state.trail.length);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (state.running) {
    for (let i = 0; i < 2; i += 1) stepPhysics(dt / 2);
  }
  render();
  requestAnimationFrame(frame);
}

function shuffle() {
  state.a1 = Math.PI * (0.35 + Math.random() * 0.75);
  state.a2 = Math.PI * (0.55 + Math.random() * 0.9);
  state.v1 = (Math.random() - 0.5) * 0.18;
  state.v2 = (Math.random() - 0.5) * 0.24;
  state.trail = [];
}

controls.toggleRun.addEventListener("click", () => {
  state.running = !state.running;
  controls.toggleRun.textContent = state.running ? "Pause" : "Resume";
});
controls.shuffle.addEventListener("click", shuffle);
controls.clearTrail.addEventListener("click", () => {
  state.trail = [];
});
window.addEventListener("resize", resize);

resize();
requestAnimationFrame(frame);
