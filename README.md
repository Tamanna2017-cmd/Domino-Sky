# Domino Sky: Flight Disruption Cascade & Recovery Simulator

> *"Show the Dominoes."* — A deterministic aircraft-rotation cascade engine, interactive air traffic control visualizer, and AI operations recovery advisor for single-day airline networks.

---

## ✈️ 1. Problem Context & Core Concept

In commercial aviation, flights do not operate in isolation. An airline network is fundamentally a set of **aircraft rotations (tail chains)** where physical aircraft fly 4 to 7 consecutive legs through an operating day.

```
VT-DS04:
DEL 07:45 ──▶ BOM 08:50 (turnaround 30m) ──▶ GOI 09:20 ──▶ BOM 11:35 ──▶ PNQ 12:50 ──▶ BOM 14:45 ──▶ AMD
```

When a severe thunderstorm halts departures at Mumbai (BOM) for 90 minutes:
1. **The Rotational Domino**: The inbound plane lands late. Even after consuming turnaround buffers, the subsequent flight to Pune (PNQ) departs late **under clear blue skies**.
2. **The Connection Domino**: Passengers arriving on delayed flights miss their connecting layovers (Minimum Connecting Time < 45 min), stranding hundreds of travellers far from the original storm cell.
3. **The Airport Congestion Rebound**: When the ground stop lifts, queued aircraft exceed hourly departure slot capacity, triggering rolling delay ripples.

**Domino Sky** simulates this causal cascade deterministically, visualizes every domino link, and equips flight operations controllers with 6 tactical recovery levers and a prescriptive AI Smart Advisor.

---

## 🛠️ 2. System Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                              DOMINO SKY UI                             │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │     Control Panel     │  │  Center Viewport │  │ Insights & KPIs │  │
│  │  - Weather Triggers   │  │  - Great-Circle  │  │ - Damage Meter  │  │
│  │  - 6 Recovery Levers  │  │    D3-Geo Map    │  │ - Before/After  │  │
│  │  - Decision History   │  │  - Gantt Timeline│  │ - Causal Graph   │  │
│  │  - Undo / Redo        │  │  - Network Graph │  │ - Stranded Pax  │  │
│  └───────────────────────┘  └──────────────────┘  └─────────────────┘  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Zustand Reactive State
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DETERMINISTIC CASCADE ENGINE                        │
│                                                                        │
│   • SchedState Fixpoint Iterator (Slot book, holding, enroute)         │
│   • Turnaround & Aircraft Continuity (actualDep = max(...))           │
│   • Causal Graph Generator (Root vs Propagated depth & parentId)       │
│   • Passenger Connection Validator (Layover < MCT ➔ Stranded)          │
│   • Financial Cost Breakdown (Delay + Cancel + Hotel/Pax + Recovery)   │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                             DATA LAYER                                 │
│   • Official Competition Dataset (16 airports, 68 flights, 16 tails)   │
│   • Standby Metal (VT-DS17 at BLR, VT-DS18 at DEL)                     │
│   • Connection Matrix (CX01–CX21) & Crew Rosters (CR01–CR16)           │
│   • Generic CSV/JSON Drag & Drop Importer with Schema Auto-Mapping     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frontend Framework**: React 18, Vite, TypeScript
- **State Management**: Zustand with immutable undo/redo history stacks
- **Mapping & Geodesics**: `d3-geo` (Spherical `geoInterpolate` for real-time aircraft positions along Great-Circle flight arcs; embedded offline India boundaries)
- **Styling & Motion**: Tailwind CSS, Framer Motion, ATC Dark Navy Radar Aesthetic (`#03050c`, `#00f0ff`, `#f59e0b`, `#ef4444`)
- **Testing**: Vitest with unit tests for simulation rules, turnaround bounds, connection breaches, and determinism.

---

## 🧮 3. Simulation Rules & Mathematical Model

For every flight $i$ in chronological sequence, the actual departure minute is evaluated as:

$$\text{actualDep}_i = \max \Big( \text{schedDep}_i + \text{retime}_i, \; \text{actualArr}_{\text{prev}(i)} + \text{minTurnaround}, \; \text{airportOpenTime}(\text{origin}_i), \; \text{slotQueueTime}(\text{origin}_i), \; \text{holdTime}_i \Big)$$

$$\text{actualArr}_i = \text{actualDep}_i + \text{blockTime}_i + \text{enrouteWeatherPenalty}_i$$

1. **Weather Severity**:
   - **Severity 1 (Capacity Squeeze)**: Hourly departure capacity halved (rebound congestion delay).
   - **Severity 2 (Ground Stop)**: Departures suspended for duration; aircraft held on ground.
   - **Severity 3 (Full Closure)**: Arrivals held in air or diverted to nearest geographic alternate.
2. **Connection Breakage**:
   $$\text{layover} = \text{actualDep}_B - \text{actualArr}_A$$
   If $\text{layover} < 45\text{ min}$ (or flight $B$ departs before $A$ lands), connection is broken and passengers are marked as **Stranded**.
3. **Circuit-Breaker Cancellation Rule**:
   If accumulated delay exceeds the cancellation threshold ($240\text{ min}$ default), flight is cancelled. Downstream legs are broken unless repaired by a controller action.
4. **Causal Graph**:
   Tracks causal lineage (`ROOT_WEATHER` vs `PROPAGATED`) and increments `cascadeDepth` ($0, 1, 2, \dots$) to explain *why* any flight is delayed.

---

## 🎮 4. Operational Recovery Levers

1. **Aircraft Swap**: Swaps tail assignments between two flights at the same station if seat capacity $\ge$ passenger load. The on-time aircraft absorbs the critical high-value connection bank.
2. **Cancel to Recover**: Pre-emptively cancels a low-load leg to reset an aircraft's schedule, preventing delay leakage into 4 subsequent legs.
3. **Hold Connection**: Holds departure $B$ up to $60\text{ min}$ for inbound connecting passengers from delayed flight $A$.
4. **Deploy Standby Aircraft**: Injects reserve metal (`VT-DS17` at BLR or `VT-DS18` at DEL) to take over a heavily delayed tail rotation.
5. **Pre-emptive Retiming**: Shifts departures earlier to escape an approaching convective squall.
6. **Passenger Auto-Rebooking**: Rebooks misconnected passengers onto later departures with available capacity.

---

## 🤖 5. AI Smart Advisor (Prescriptive Operations)

- **Monte Carlo Candidate Generation**: Evaluates permutations of swaps, holds, cancellations, and standby activations.
- **Pareto Scoring Function**:
  $$\text{Gain} = \Delta \text{DelayMin} + 25 \times \Delta \text{PaxRescued} + \frac{\Delta \text{Cost}}{5000} - 6 \times \Delta \text{CancelledFlights}$$
- **One-Click "Auto-Optimise"**: Greedily applies the highest-ranked actions step-by-step until marginal gain falls below threshold, animating the network recovery in real time.
- **Scorecard (A to F)**: Evaluates user decisions against the AI benchmark and unmitigated baseline.

---

## 🚀 6. Quick Start & Run Instructions

### Prerequisites
- Node.js 18+ and npm

### Installation & Run
```bash
# Clone and navigate to workspace
cd c:\demo

# Install dependencies (already installed in workspace)
npm install

# Run Vitest unit tests (all 21 tests pass in ~150ms)
npm test

# Run TypeScript typecheck
npm run typecheck

# Build production bundle
npm run build

# Start local development server
npm run dev
```

---

## ⏱️ 7. 3-Minute Demo Presentation Script for Judges

| Timestamp | Screen / Action | What to Say / Demonstrate |
| :--- | :--- | :--- |
| **0:00 - 0:40** | **Intro & Scenario Launch**<br>Click *"Launch Simulator"*.<br>Select *"Mumbai Monsoon Storm"* preset. | *"Judges, airlines don't fly isolated routes—they fly aircraft rotations. Here, a 90-minute storm hits Mumbai at 14:00. Watch the red storm cell pulse over BOM."* |
| **0:40 - 1:20** | **Show the Cascade (The Dominoes)**<br>Press Play (Space) or scrub to `15:30`.<br>Click delayed flight on Map or switch to **Gantt view**. | *"Look at the dominoes falling: Flight DS0404 lands late in Mumbai, which delays DS0405 to Ahmedabad under clear skies. Click DS0405: the Causal Inspector proves it's 2 levels deep, causing 43 passengers at Ahmedabad to miss their connection. Notice our Damage Meter ticking up: 1,840 delay minutes and 280 stranded passengers."* |
| **1:20 - 2:10** | **Execute Manual Recovery Levers**<br>Apply **Hold Connection** (+30m).<br>Deploy **Standby Aircraft** (`VT-DS17`). | *"Now we intervene. In the Left Panel, we apply a 30-minute hold to save 43 connecting passengers. Then, we deploy standby aircraft VT-DS17 from Bengaluru. Instantly, the simulation recomputes: the 'Before vs After' card proves our decisions saved 640 delay minutes and rescued 92 passengers."* |
| **2:10 - 2:45** | **AI Smart Advisor & Auto-Optimise**<br>Click **🤖 AI Advisor**.<br>Click **⚡ Auto-Optimise Network**. | *"For automated recovery, open the AI Smart Advisor. It ranks candidate interventions by delay saved, passengers rescued, and cost. Watch the 'Auto-Optimise' algorithm greedily apply the best moves step-by-step. Our Operations Grade leaps from F to A!"* |
| **2:45 - 3:00** | **Executive Report & Data Layer**<br>Click **📄 Report**.<br>Show Load Data schema-mapper. | *"Finally, controllers export an executive incident audit with full financial breakdown and PDF/JSON export. And our Data Layer supports drag-and-drop CSV upload with custom column mapping. Domino Sky proves that when dominoes fall, intelligent operations can pick them right back up."* |
