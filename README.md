# Zoria — Tournament AI Champion & Game Headquarters

[![CI](https://github.com/roman-nalapko/zoria/actions/workflows/ci.yaml/badge.svg)](https://github.com/roman-nalapko/zoria/actions/workflows/ci.yaml)
[![Node.js](https://img.shields.io/badge/node.js-24+-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tests-124%20passed-brightgreen.svg)](https://vitest.dev/)
[![Reliability](https://img.shields.io/badge/K1%20defects-0%20of%209-brightgreen.svg)](#tournament-achievements)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

An autonomous tournament agent, analytics headquarters (HQ), and cryptographically verified live-stream client engineered for the **Zoria 2026** AI competition.

The platform demonstrates distributed real-time decision-making under strict deadline constraints (500ms ticks), graph-based topological territory expansion, chaos-engineering resilience against process terminations (`SIGKILL`), and an interactive scrubbable game replay headquarters.

---

## Tournament Achievements

- 🥈 **Group Stage 2nd Place (Group 6)**: Scored **22 out of 24 points** (Match 1: 8 pts 🥇, Match 2: 8 pts 🥇, Match 3: 6 pts 🥈), achieving an average pack share of **7.33**.
- 🏆 **Top-15 Overall Standing**: Finished in the top 15 out of 57 competing teams across all groups.
- 🛡️ **Zero Protocol Defects (K1 Reliability)**: **0 defects across all 9 official matches** — 100% oath acceptance, 0 malformed frames, 0 phantom ticks, and 0 unwanted fallbacks to the offline charter.
- ⚡ **Level 3 Provocateur Chaos Resilience**: 100% pass rate under adversarial network chaos testing (`--provoke 3`), successfully recovering from mid-game `SIGKILL` process kills and network severance while winning 9 out of 9 local matches.
- 🖥️ **HQ Benchmark Compliance**: Passed **20 out of 20** automated verification tasks in `zaria-kit hq-check`.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │             Zoria Game Engine                │
                      │         (WebSocket Wire Protocol)            │
                      └───────▲───────────────────────────────▲──────┘
                              │ Wire Frames (CBOR / JSON)     │
                              ▼                               ▼
       ┌─────────────────────────────────────┐ ┌─────────────────────────────┐
       │     Autonomous Champion Bot         │ │  Fallback Charter (Nakaz)   │
       │   - DFS Crown Cycle Detection       │ │  - Offline YAML State Machine│
       │   - 8-Weight Swarm Optimization     │ │  - Zero-State Cold Failover │
       │   - Connected Dynamic Auction Bids  │ └─────────────────────────────┘
       │   - Real-time A* / Dijkstra Routing │
       └──────────────────┬──────────────────┘
                          │ Telemetry & State (/state)
                          ▼
       ┌─────────────────────────────────────────────────────────────────────┐
       │                  Docker Multi-Service Stack                         │
       │  ┌───────────────────────┐         ┌─────────────────────────────┐  │
       │  │   Control Plane       │         │   Status Monitor            │  │
       │  │   (:7801 /metrics)    │         │   (:7811 /state)            │  │
       │  └───────────────────────┘         └─────────────────────────────┘  │
       └─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
       ┌─────────────────────────────────────────────────────────────────────┐
       │                Interactive Game Headquarters (HQ)                   │
       │  - Frame-accurate Canvas & SVG Scrubbable Replay Engine             │
       │  - Host-Guest postMessage Protocol (ZARIA_HQ Contract)              │
       │  - Network Heatmaps, Time Dilation & Anomaly Visualizer             │
       └─────────────────────────────────────────────────────────────────────┘
```

---

## Key Modules

| Module                                                     | Responsibility                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`bot/src/strategy.ts`](bot/src/strategy.ts)               | Core Champion AI: graph algorithms, DFS crown cycle formulation, auction bids, role management. |
| [`bot/src/main.ts`](bot/src/main.ts)                       | WebSocket wire transport, resume tokens, monotonic sequence tracking, jitter discipline.        |
| [`bot/nakaz.yaml`](bot/nakaz.yaml)                         | Fallback engine charter executed server-side if bot socket or container drops.                  |
| [`bot/src/status.ts`](bot/src/status.ts)                   | Internal healthcheck microservice (`:7811`) exposing live telemetry and state.                  |
| [`hq/src/hq.js`](hq/src/hq.js)                             | Headquarters state machine, replay parser, seeker, and driver for all 20 benchmark tasks.       |
| [`hq/src/guest.js`](hq/src/guest.js)                       | Host-guest communication bridge implementing the `ZARIA_HQ` postMessage protocol.               |
| [`control-plane/src/main.mjs`](control-plane/src/main.mjs) | Canonical Prometheus-compatible `/metrics` and `/health` HTTP endpoints (`:7801`).              |
| [`src/ether/verifier.ts`](src/ether/verifier.ts)           | HMAC-SHA256 signature verification and tamper-proof ether assembly.                             |
| [`src/app/`](src/app/)                                     | React 19 + TypeScript participant web dashboard.                                                |
| [`src/worker/`](src/worker/)                               | Background digest runner with Telegram alerting and state persistence.                          |

---

## Architectural Highlights & Engineering Decisions

Detailed trade-offs and rationale are formally documented in [**`DECISIONS.md`**](DECISIONS.md) in accordance with Section 10 of the tournament rubric:

1. **Crown Cycle Formulator (Вінцевий цикл) vs. Greedy Expansion**:
   - _Choice_: Algorithmic DFS search on the local graph simulation to identify a minimal closed 6-needle cycle connected to the starting chain.
   - _Trade-off_: Incurs a 2–3 tick delay during early-game expansion, but secures a permanent **+15% point multiplier** ($x1.15$) across the entire territory for the rest of the match ([`bot/src/strategy.ts#L144-L215`](bot/src/strategy.ts#L144-L215)).
2. **Fixed Squad Composition (3 Weavers + 2 Klinoks) vs. Mono-Swarm**:
   - _Choice_: Rigid squad cap of 8 weight points ($3 \times 2 + 2 \times 1$) with dedicated Sentinel (cut-vertex & base defense) and Hunter (interception) roles.
   - _Trade-off_: Sacrifices brute-force mono-weaver speed, but eliminates engine weight faults ($0$ weight penalties across all 9 matches) and prevents network fragmentation ([`bot/src/strategy.ts#L557-L579`](bot/src/strategy.ts#L557-L579)).
3. **Targeted Connected Auction Bidding vs. Distant Sniping**:
   - _Choice_: Bids only on lots with graph distance $\le 8$ from base or $\le 5$ from active needles at a fixed 71 energy threshold.
   - _Trade-off_: Prevents wasting energy on unreachable neutral needles that competitors easily jam or disconnect ([`bot/src/strategy.ts#L444-L469`](bot/src/strategy.ts#L444-L469)).

---

## Development & Verification

### Prerequisites

- Node.js 24+
- npm 11+
- Docker & Docker Compose (optional, for full container stack)

### 1. Install & Verify Full Project Gate

Runs Prettier format check, ESLint zero-warning linting, strict TypeScript build, worker compilation, and Vitest suite:

```bash
npm ci
npm run check
```

### 2. Run Local Bot Pack Play

Simulates a full 3-match local tournament pack with engine validation:

```bash
npm --prefix bot run play -- --fast
```

### 3. Run Level 3 Chaos Provocateur Test

Tests resilience against process termination (`SIGKILL`) and mid-match network severance:

```bash
npm --prefix bot run play -- --fast --provoke 3
```

### 4. Run Interactive Game Headquarters (HQ)

```bash
cd hq
npm ci
npm run dev
# Open http://localhost:5173
```

### 5. Launch Dockerized Multi-Container Stack

```bash
docker compose up --build
```

- Control Plane: `http://localhost:7801/metrics` and `http://localhost:7801/health`
- Bot Status Server: `http://localhost:7811/state`

---

## License

This project is licensed under the MIT License.
