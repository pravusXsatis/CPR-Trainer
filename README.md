# CPR Trainer — IDEA Hacks 2026

> **Theme: A Brighter Tomorrow** | **Subcategory: Educate the Future**
>
> Affordable, hands-on CPR practice — anywhere, anytime, no mannequin required.

---

## Inspiration

Cardiac arrest strikes more than 350,000 people outside of hospitals in the United States every year. Immediate bystander CPR can double or triple a victim's chance of survival — yet the vast majority of people have never practiced it. The barrier is not awareness; it is access. Certified CPR training requires scheduling a class, traveling to a facility, and working with expensive mannequins that cost hundreds to thousands of dollars per unit.

We built CPR Trainer to remove that barrier entirely. It is a wrist-worn device that turns any springy surface — a couch cushion, a foam mat, a folded blanket — into a CPR practice station. A user connects their phone to the device's own Wi-Fi network, opens the dashboard in a browser, and receives real-time, per-compression coaching with zero setup friction and zero ongoing cost.

---

## Why This Is an "Educate the Future" Project

The rubric asks whether a project enhances how people learn, can realistically integrate into daily life, offers a unique educational approach, and is intuitive, engaging, and enjoyable to use. CPR Trainer addresses each of these directly:

- **Enhances how people learn CPR.** Rather than watching a video or attending a one-time class, the user gets immediate, quantified feedback on every compression — rate, relative force, and full release — forming correct muscle memory through repetition.
- **Integrates into daily life.** The device requires no mannequin, no facility, and no internet connection. Practice happens wherever someone already is, with the phone already in their pocket.
- **Unique educational approach.** A guided calibration step personalizes feedback thresholds to the individual user and surface. This makes coaching adaptive, not one-size-fits-all.
- **Intuitive and engaging.** The dashboard opens instantly in a browser from a captive portal. Calibration walks users through setup with countdowns and Ready/Set/Go prompts.

---

## What It Does

The CPR Trainer wrist module samples force and acceleration at **50 Hz** using an FSR and ADXL335. The ESP32 creates a WPA2 Wi-Fi access point (`CPR_Trainer`), serves a captive portal at `http://192.168.4.1`, and streams live sensor data to the dashboard with no app install and no cloud dependency.

### Live feedback on every compression

| Signal | What it means |
|---|---|
| **Good compression** | Peak force is within the user's calibrated target range |
| **Push harder** | Peak force is below 60% of calibrated target |
| **Too hard** | Peak force exceeds 130% of calibrated target |
| **Release fully** | Force did not return near baseline (leaning detected) |
| **Too slow / Good rate / Too fast** | Compression cadence relative to 100-120 CPM |
| **Start compressions** | Idle state, ready to begin |

### Dashboard at a glance

- **Compression rate gauge** — live CPM needle against the AHA target band (100-120 CPM)
- **Relative-force trend graph** — scrolling plot of the last 100 force readings with target-force reference line
- **Metric cards** — compression count, rate, raw force, relative force, target force, recoil threshold
- **Motion quality metric** — sum of corrected accelerometer magnitudes (`|X| + |Y| + |Z|`)
- **Guided calibration modal** — 3-step flow with Ready/Set/Go cues and recoil confirmation

---

## How We Built It

### Hardware

| Component | Role |
|---|---|
| ESP32 | Microcontroller, Wi-Fi access point, captive portal, web server |
| FSR (voltage divider) | Relative compression force sensing (GPIO33) |
| ADXL335 accelerometer | Motion quality channels X/Y/Z (GPIO34/35/32) |
| External power bank | Portable power for demos |

### Software Stack

| Layer | Technology | Source |
|---|---|---|
| Firmware | Arduino C++ | `cpr-trainer-mvp/firmware/esp32_cpr_trainer.ino` |
| Frontend | React + Vite (dev), static dashboard served on ESP32 (demo) | `cpr-trainer-mvp/frontend/src/App.jsx` |
| Backend (optional legacy/dev) | Python / FastAPI + pyserial | `cpr-trainer-mvp/backend/main.py` |

The main submission path is standalone on ESP32: SoftAP + captive portal + direct `/data` polling. The backend remains in the repo as an optional simulator/dev fallback.

### 3-Step Guided Calibration

The calibration modal walks the user through setup before each session:

1. **Rest baseline** — place trainer flat and do not press; dashboard calls `GET /calibrate/rest`.
2. **Target compression** — hold what feels like a good compression; dashboard calls `GET /calibrate/target`.
3. **Recoil confirmation** — release fully; dashboard checks `/data` until `forceCorrected` is near baseline.

This produces personalized relative-force coaching per user and per surface.

### Compression Quality Logic

- Compression starts when corrected force rises above a start threshold.
- Peak force is classified against calibrated `forceTarget`:
  - `< 60%` -> **Push harder**
  - `60% - 130%` -> **Good compression**
  - `> 130%` -> **Too hard**
- Recoil quality checks whether force returns near baseline after each compression.
- Rate feedback uses cadence ranges around the target 100-120 CPM.

> ⚠️ Training feedback only — not a certified medical device.

---

## Current Status

The standalone ESP32 demo path is working and demo-ready, with optional backend simulation still available for development.

| Component | Status |
|---|---|
| ESP32 firmware — SoftAP, captive portal, `/data`, calibration endpoints | Working |
| Frontend dashboard — guided calibration + live coaching UI | Working |
| Optional backend — simulator + legacy/dev API path | Working |
| Hardware enclosure/wristband refinement | In progress |

---

## Accomplishments We're Proud Of

- **Standalone offline workflow** — complete demo runs from ESP32 only (no laptop backend required).
- **Adaptive calibration** — thresholds are personalized by rest/target capture on the current surface.
- **Captive portal UX** — users connect to `CPR_Trainer` and immediately land on the dashboard.
- **Demo reliability hardening** — WPA2 AP password and AP client limit to keep polling responsive.

---

## Vibe Coding — AI-Assisted Development

All three layers of the codebase — firmware (Arduino C++), backend (Python/FastAPI), and frontend (React) — were built with heavy AI assistance throughout the hackathon. This section documents both benefits and concrete obstacles for the DigiKey challenge documentation requirement.

### What worked well

LLMs accelerated full-stack scaffolding from blank files to a functional prototype in a single hackathon cycle: firmware endpoint scaffolds, frontend calibration UX flow, and backend simulator primitives were generated quickly and iterated by hand.

### Obstacles with AI-generated code

**1. Force graph normalization bugs**

Several AI-generated graph versions rendered force values incorrectly due to faulty SVG coordinate normalization. Fixing it required manual validation of the mapping math and explicit prompting constraints.

**Lesson:** treat AI visualization math as draft logic; verify formulas manually.

**2. Calibration and state-flow edge cases**

Generated calibration flows initially had race conditions and indefinite waits (for example, recoil confirmation waits). Stabilizing required explicit timeout logic, bounded retries, and clearer modal state transitions.

**Lesson:** AI can scaffold the happy path quickly, but robust state handling still needs deliberate human-driven error-path design.

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

```text
README.md                               # Main submission README
cpr-trainer-mvp/
  firmware/
    esp32_cpr_trainer.ino               # ESP32 SoftAP + captive portal + data/calibration endpoints
    README.md                           # Firmware-specific notes (kept separate)
  frontend/
    src/
      App.jsx                           # Dashboard and guided calibration UI
      styles.css
    index.html
    package.json
    vite.config.js
  backend/
    main.py                             # Optional legacy/dev backend + simulator
    requirements.txt
  hardware/
    board/                              # KiCad project and backups
```

---

## Quick Start

### 1 — Flash the ESP32

1. Open `cpr-trainer-mvp/firmware/esp32_cpr_trainer.ino` in Arduino IDE.
2. Select an ESP32 board (for example, **ESP32 Dev Module**) and upload.
3. Open Serial Monitor at **115200 baud** to confirm startup.

### 2 — Run Standalone Demo (primary path)

1. Power the board.
2. Connect to Wi-Fi:
   - SSID: `CPR_Trainer`
   - Password: `cprtrainer2026` (WPA2)
3. Open `http://192.168.4.1` if captive portal does not auto-open.
4. Start guided calibration and practice compressions.

The SoftAP is limited to 2 client connections to reduce contention and keep dashboard updates responsive during demos.

### 3 — Optional Local Frontend Dev

```bash
cd cpr-trainer-mvp/frontend
npm install
npm run dev
```

### 4 — Optional Backend Simulator (legacy/dev only)

```bash
cd cpr-trainer-mvp/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:CPR_SIMULATOR="1"
uvicorn main:app --reload --port 8000
```
