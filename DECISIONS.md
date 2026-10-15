# Engineering decisions

This document fulfills the requirements of Section 10 (`scoring.md`, 10.1 and 10.3) for the tournament debrief (`DECISIONS.md`).

---

## 1. Module map

Every bot, HQ, and supporting module with its single-line responsibility:

| Module                       | Responsibility                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bot/src/main.ts`            | Bot service entry point, WebSocket/wire connection lifecycle, and heartbeat loop                                                    |
| `bot/src/strategy.ts`        | Champion AI strategy implementation (`Champion` class) for pathfinding, economy, crown cycle, auctions, diplomacy, and unit control |
| `bot/src/status.ts`          | Internal HTTP status microservice (`STATUS_PORT: 7811`) providing `/state` healthchecks for Docker and control-plane telemetry      |
| `bot/src/jitter.ts`          | Jitter calculation utility to randomize network timing within bounded protocol constraints                                          |
| `bot/nakaz.yaml`             | Bot fallback charter (наказ) executed by the engine if the bot process or socket disconnects                                        |
| `hq/src/index.html`          | Single-page application HTML template hosting the interactive tournament headquarters (HQ)                                          |
| `hq/src/hq.js`               | Core HQ runtime state manager, record parser, cursor seeker, and anchor driver for all 20 verification tasks                        |
| `hq/src/guest.js`            | HQ host-guest communication bridge exposing the `ZARIA_HQ` contract and iframe postMessage handlers                                 |
| `hq/src/strings.js`          | Canonical translation dictionary, formatting helpers, and string constants for HQ telemetry display                                 |
| `hq/src/style.css`           | Visual styling, theme palettes, and layout rules for the HQ dashboard                                                               |
| `control-plane/src/main.mjs` | HTTP microservice (`PORT: 7801`) exposing canonical `/health` and `/metrics` telemetry endpoints                                    |
| `src/app`                    | React client application screens and participant dashboard user interface                                                           |
| `src/api`                    | Zoria API transport, contracts, retry strategies, and rate discipline                                                               |
| `src/ether`                  | Signed-frame verification and monotonic ether state management                                                                      |
| `src/auth`                   | Registration, session vault, and authentication lifecycle                                                                           |
| `src/worker`                 | Standalone background runner for automated tournament digests, Telegram alerts, and state tracking                                  |

---

## 2. Three decisions

### Decision 1: Crown Cycle Formulator (Вінцевий цикл) vs Greedy Expansion

- **What was chosen:**
  An algorithmic DFS search (`dfs` in `init`) using the local engine simulation graph to discover a minimal closed 6-needle cycle connected to our start chain, prioritizing the completion of this cycle to activate the constant $+15\%$ multiplier ($x1.15$) across the entire network.
- **Alternative considered:**
  Greedy nearest-needle expansion (dispatching Weavers step-by-step to the closest ruins strictly based on Euclidean/hex distance regardless of network topology).
- **Cost of choice:**
  Upfront time and energy cost: Weavers travel past immediate unlinked ruins to secure specific cycle vertices, spending $\approx 2\text{--}3$ extra move ticks and delaying early raw territory coverage; in return, it secures a permanent $+15\%$ multiplier on every subsequent tick.
- **Code location:**
  `bot/src/strategy.ts#L144-L215` (cycle search and topological vertex selection in `init`) and `bot/src/strategy.ts#L1022-L1057` (prioritized dispatch of Weavers to unlit crown cycle ruins).

---

### Decision 2: Fixed Squad Composition (3 Weavers + 2 Klinoks) vs Adaptive Mono-Swarm

- **What was chosen:**
  A strictly enforced squad weight cap of 8 using exactly 3 Weavers ($3 \times 2 = 6\text{ weight}$) and 2 Klinoks ($2 \times 1 = 2\text{ weight}$), assigning one Klinok as Sentinel (defending network cut-vertices and base against infiltrators) and one as Hunter (intercepting Keeper orders and ramming enemy Weavers).
- **Alternative considered:**
  A mono-weaver expansion swarm (4 Weavers, 0 Klinoks) or a heavy combat swarm (2 Weavers + 4 Klinoks).
- **Cost of choice:**
  Sacrifices late-game combat mass (fielding only 2 combat units compared to potential swarms of 4--6 blades), but guarantees zero "вага рою" rejections ($0$ engine weight faults across all $9$ tournament games), utilizes $100\%$ of the squad weight capacity, and provides dedicated defensive interception against network fragmentation.
- **Code location:**
  `bot/src/strategy.ts#L557-L579` (shipyard production and squad weight limits) and `bot/src/strategy.ts#L616-L677` (Sentinel vs Hunter role dispatch).

---

### Decision 3: Targeted Connected Auction Bidding (71 Energy Threshold) vs Aggressive Central Sniping

- **What was chosen:**
  Bidding on auctions only if the lot needle is within distance $\le 8$ of our base or $\le 5$ of our lit needles, submitting a bid of 71 energy (designed to outbid standard 60 and 65 baseline presets).
- **Alternative considered:**
  Aggressive central lot sniping (bidding on all lots on the map, including distant enemy territory) or complete auction avoidance.
- **Cost of choice:**
  Deducts 71 energy upon bid victory and forfeits distant high-yield lots; in return, prevents wasting 71--142 energy on isolated, unconnectable needles on the opposite side of the map that enemies easily jam or cut off.
- **Code location:**
  `bot/src/strategy.ts#L444-L469` (auction lot utility filtering and 71 energy bid submission).

---

## 3. Known limitations

- **Vulnerability in passive 3rd-player FFA scenarios:**
  In a 3-player match, if one opponent plays passively or collapses early, the other opponent can freely claim the uncontested half of the map without interference, gaining a raw connection minute advantage during Dawn (as observed in Match 3 against `btema2`).
- **Static auction bid ceiling:**
  The bid value of 71 energy is statically hardcoded. If an aggressive competitor bids 72 or higher, our bot does not dynamically escalate its bid and yields the lot.
- **Network preservation over Dawn Ring suicide rams:**
  During Dawn (ticks 1000--1200), the bot prioritizes maintaining active network connection and preserving shuttles over engaging in high-risk suicide rams on the central neutral Ring.
