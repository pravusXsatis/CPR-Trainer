# CPR Trainer — IDEA Hacks 2026

> **Theme: A Brighter Tomorrow** | **Subcategory: Educate the Future**
>
> Affordable, hands-on CPR practice — anywhere, anytime, no mannequin required.

---

## Inspiration

Cardiac arrest strikes more than 350,000 people outside of hospitals in the United States every year. Immediate bystander CPR can double or triple a victim's chance of survival — yet the vast majority of people have never practiced it. The barrier isn't awareness; it's access. Certified CPR training requires scheduling a class, traveling to a facility, and working with expensive mannequins that cost hundreds to thousands of dollars per unit.

We built the CPR Trainer to remove that barrier entirely. It is a wrist-worn device that turns any springy surface — a couch cushion, a foam mat, a folded blanket — into a CPR practice station. A user connects their phone to the device's own Wi-Fi network, opens the dashboard in a browser, and receives real-time, per-compression coaching with zero setup friction and zero ongoing cost.

---

## Why This Is an "Educate the Future" Project

The rubric asks whether a project enhances how people learn, can realistically integrate into daily life, offers a unique educational approach, and is intuitive, engaging, and enjoyable to use. CPR Trainer addresses each of these directly:

- **Enhances how people learn CPR.** Rather than watching a video or attending a one-time class, the user gets immediate, quantified feedback on every compression — rate, force, and full release — forming correct muscle memory through repetition.
- **Integrates into daily life.** The device requires no mannequin, no facility, and no internet connection. Practice happens wherever someone already is, with the phone already in their pocket.
- **Unique educational approach.** A calibration step personalizes the feedback thresholds to the individual user and surface. This makes the coaching adaptive, not one-size-fits-all.
- **Intuitive and engaging.** The dashboard opens instantly in any browser. The guided calibration walks users through setup in under 30 seconds with a countdown UI. Feedback is immediate, plain-language, and per-compression.

---

## What It Does

The CPR Trainer wristband samples compression force at **50 Hz** using an FSR (Force-Sensitive Resistor). An optional MPU6050 IMU adds wrist-motion tracking for form quality. The ESP32 microcontroller broadcasts its own Wi-Fi access point; the user connects their phone or laptop to that network and opens the React dashboard at `http://192.168.4.1` — no app install, no internet.

### Live feedback on every compression

| Signal | What it means |
|---|---|
| **Good compression** | Peak force is within the user's calibrated target range |
| **Push harder** | Peak force is below 60 % of the calibrated target |
| **Too hard** | Peak force exceeds 130 % of the calibrated target |
| **Release fully** | Force did not drop back to baseline — leaning detected |
| **Start compressions** | Idle state, ready to begin |

### Dashboard at a glance

- **Compression rate gauge** — live CPM needle against the AHA target band of 100–120 CPM
- **Relative-force trend graph** — scrolling plot of the last 100 force readings with a target-force reference line
- **Metric cards** — compression count, rate, raw force, relative force, target force, and recoil threshold
- **Motion quality score** — sum of corrected accelerometer magnitudes (|X| + |Y| + |Z|) as a wrist-form indicator
- **Guided calibration modal** — 3-step flow with countdown UI, "Ready / Set / Go" cues, and recoil confirmation

---

## How We Built It

### Hardware

| Component | Role |
|---|---|
| ESP32 | Microcontroller, Wi-Fi access point, web server |
| Adafruit Square FSR (via voltage divider) | Compression force sensing on GPIO 34 |
| MPU6050 IMU (optional, I²C) | Wrist-motion quality on GPIO 21 / 22 |
| External power bank | Keeps the wristband module lightweight |

The ESP32 samples the FSR at 50 Hz and emits compact JSON over serial:
```json
{"t":12345,"force":1842,"ax":0.02,"ay":0.11,"az":1.21}
```
If the MPU6050 is absent, the sketch still runs — `ax`, `ay`, `az` fields are simply omitted.

### Software Stack

| Layer | Technology | Source |
|---|---|---|
| Firmware | Arduino C++ | `firmware/esp32_cpr_trainer.ino` |
| Backend | Python / FastAPI + pyserial | `backend/main.py` |
| Frontend | React + Vite | `frontend/src/App.jsx` |

The FastAPI backend reads the serial JSON stream, runs the CPR metric engine, and pushes live data to every connected browser over a **WebSocket** (`/ws`). The frontend polls at 50 ms and renders all metrics without page reload.

### 3-Step Guided Calibration

The calibration modal walks the user through setup before each session:

1. **Rest baseline** (3 s sample) — establishes the zero-compression ADC floor for this surface and sensor placement.
2. **Target compression** — user presses with their intended CPR force; this fixes the "good" force reference and the dynamic detection threshold (`max(70, (max_force − baseline) × 0.12)`).
3. **Recoil confirmation** — system waits up to 6 s for force to return within 30 ADC units of baseline, confirming the surface has enough spring-back to detect full release.

### Compression Detection (inside `backend/main.py`)

- **Enter** compression when force rises above `baseline + dynamic_threshold`.
- **Count** (250 ms debounce) when force falls back to `baseline + max(40, dynamic_threshold × 0.4)`.
- **Force score** = `peak_force_above_baseline / calibrated_span`, clamped 0 → 1.
- **Rhythm consistency** = `1 − CV` of the last 20 inter-compression intervals (coefficient of variation).
- **Release quality** = fraction of compressions where force returned within 30 ADC units of true baseline.

Feedback priority order: release quality → force score → rate.

> ⚠️ Training feedback only — not a certified medical device.

---

## Current Status

The project is actively in progress — all three layers (firmware, backend, frontend) are partially working and being iterated on simultaneously.

| Component | Status |
|---|---|
| ESP32 firmware — FSR sampling + serial JSON | Partially working |
| FastAPI backend — serial reader, metric engine, WebSocket | Partially working |
| React dashboard — rate gauge, force graph, feedback card | Partially working |
| Hardware assembly (wristband form factor) | In progress |
| End-to-end integration (hardware → dashboard) | In progress |

The simulator mode (`CPR_SIMULATOR=1`) allows the full software stack to be developed and demonstrated without completed hardware.

---

## Accomplishments We're Proud Of

- **Adaptive calibration** — thresholds are personalized per user and per surface, so feedback is meaningful whether someone is pressing on a firm foam mat or a soft cushion.
- **Simulator mode** built into the backend that cycles through scripted CPR scenarios (Push harder → Too slow → Good rate → Too fast → Release fully), allowing development and judging demos to proceed while hardware is still being assembled.
- A software architecture designed from the start to run standalone on the ESP32 — no PC, no router, no cloud — so the finished device will be truly self-contained.

---

## Vibe Coding — AI-Assisted Development

All three layers of the codebase — firmware (Arduino C++), backend (Python / FastAPI), and frontend (React) — were generated with heavy AI assistance using multiple LLM tools throughout the hackathon. This section documents both the benefits and the concrete obstacles we ran into, per the DigiKey challenge documentation requirement.

### What worked well

Using LLMs to scaffold the entire stack from scratch in a single hackathon session was only feasible because of AI assistance. The initial working versions of the FastAPI serial reader, the WebSocket broadcast loop, the React component structure, and the Arduino FSR sampling loop were all generated in full from natural-language prompts, giving the team a running start rather than a blank file.

### Obstacles with AI-generated code

**1. Force graph inaccuracies**

The AI-generated `ForceGraph` component in `App.jsx` produced visually incorrect output. The SVG polyline coordinate mapping did not correctly normalize force values to the graph's viewBox dimensions — readings near the top of the range were rendered near the bottom, and the y-axis scaling was inverted in edge cases. The AI consistently regenerated versions with the same underlying error when prompted generically. Fixing it required the team to manually work through the coordinate math (`y = 100 − (value / graphMax) × 100`) and explicitly specify the correct formula in the prompt, rather than asking the AI to "fix the graph."

**Lesson:** AI-generated data visualization code should be treated as a first draft that requires manual verification of the underlying math, not a finished implementation.

**2. Simulator design complexity**

Building a realistic hardware simulator — one that produces 50 Hz force data with physiologically plausible CPR waveforms, cycles through distinct feedback scenarios, and correctly interacts with the calibration and session-reset state — was significantly harder to get right via AI generation than expected. Early AI-generated simulator versions produced flat or random noise rather than shaped compression waveforms, did not respect the calibration baseline, or broke session-reset behavior. Achieving the current scripted-phase simulator (`SIMULATOR_SCRIPT` in `backend/main.py`) required multiple rounds of manual correction to the sine-wave pulse shaping, phase timing, and baseline offset logic.

**Lesson:** AI is effective at generating the structure of a simulator but struggles to get domain-specific signal shapes correct without detailed human guidance on the underlying physical model.

---

## Challenges We Ran Into

_[To be filled in by the team.]_

---

## What We Learned

_[To be filled in by the team.]_

---

## What's Next for CPR Trainer

_[To be filled in by the team.]_

---

## Repository Structure

```
cpr-trainer-mvp/
  firmware/
    esp32_cpr_trainer.ino   # FSR + MPU6050 sampling, 50 Hz serial JSON output
  backend/
    main.py                 # FastAPI — serial reader, CPR metric engine, WebSocket broadcast
    requirements.txt        # fastapi, uvicorn[standard], pyserial
  frontend/
    src/
      App.jsx               # React dashboard — rate gauge, force graph, calibration modal
      styles.css
    index.html
    package.json
    vite.config.js
```

---

## Quick Start

### 1 — Flash the ESP32

1. Open `cpr-trainer-mvp/firmware/esp32_cpr_trainer.ino` in Arduino IDE.
2. Install the **ESP32** board package and these libraries:
   - `Adafruit MPU6050`
   - `Adafruit Unified Sensor`
3. Wire FSR analog output → **GPIO 34**. Optionally wire MPU6050: SDA → GPIO 21, SCL → GPIO 22.
4. Flash. Confirm serial output at **115200 baud**:
   ```json
   {"t":12345,"force":1842,"ax":0.02,"ay":0.11,"az":1.21}
   ```

### 2 — Run the Backend

```bash
cd cpr-trainer-mvp/backend
python -m venv .venv

# Activate (Windows PowerShell):
.venv\Scripts\Activate.ps1
# Activate (macOS / Linux):
source .venv/bin/activate

pip install -r requirements.txt

# Set serial port if needed (default: COM3):
$env:SERIAL_PORT="COM5"   # PowerShell
# export SERIAL_PORT=/dev/ttyUSB0   # bash

uvicorn main:app --reload --port 8000
```

**No hardware?** Run in simulator mode instead:
```bash
# PowerShell:
$env:CPR_SIMULATOR="1"; uvicorn main:app --reload --port 8000
# bash:
CPR_SIMULATOR=1 uvicorn main:app --reload --port 8000
```

### 3 — Run the Frontend

```bash
cd cpr-trainer-mvp/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in a browser.

**On real hardware:** connect your phone or laptop to the **CPR_Trainer** Wi-Fi network broadcast by the ESP32, then open `http://192.168.4.1` in a browser. The dashboard loads directly from the device — no internet needed.
