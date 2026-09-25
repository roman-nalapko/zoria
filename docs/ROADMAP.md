# Delivery roadmap & task backlog

Updated: 2026-09-25 by Antigravity.

Checkboxes represent the work queue for coding agents and human review.
A task is complete only when its implementation, unit/component tests,
and the repository quality gate (`npm run check`) pass.

---

## Phase 0: Admission & registration (COMPLETED ✅)

All critical prerequisites for tournament participation are fulfilled and verified.

- [x] **R1–R6 (P0 reliability fixes)**: No-throw error handling, session body validation,
      state persistence between cycles, uncertain registration recovery, seamless job handover.
- [x] **R7–R12 (P1 reliability fixes)**: Rich Telegram status with Bucharest local time,
      fixed Telegram destination, Harbinger `{uk, en}` compatibility, secret leak audit clean.
- [x] **Cryptographic window registration**: Successfully executed in live window at 08:02:40 local.
- [x] **Repository admission verified**: `GET /me/repository` returned `accessStatus: "verified"`
      with `reasonCode: "marker-found"`. Verified on server 2026-09-25 09:05:18 local time.
- [x] **GitHub repository marker**: `.zoria` with `roman-nalapko` in place on default branch.
- [x] **Organizer bot access**: `zoria-net-bot` confirmed with `Write` collaborator access.

---

## Phase 1: Part 1 Web Client & Headquarters Console (Deadline: 2026-09-28)

Build the participant's network console in React + TypeScript. Must be fully operational
before Part 2 is released on September 28.

### Milestone 1.1: Shell, Layout & Routing

- [x] **T1.1**: App navigation shell with responsive header, active route indicators. _(commit bffed9d)_
- [x] **T1.2**: Route architecture (`/login`, `/dashboard`, `/news`, `/inbox`, `/stages`, `/ether`). _(commit bffed9d)_
- [x] **T1.3**: Global Error Boundary with reset action. _(commit bffed9d)_
- [ ] **T1.4**: Environment indicator & switcher (Training Stand `stand.zoria.net` vs Production `zoria.net`). _Badge implemented; interactive switcher deferred to M1.3._
- [ ] **T1.5**: Accessible status region (live ARIA announcements for network changes, countdowns, jams).

### Milestone 1.2: Authentication & Session Vault

- [x] **T2.1**: Redacted in-memory session vault (token held only in closure; never written to localStorage, logs, or diagnostic dumps). _(commit bffed9d)_
- [x] **T2.2**: Login form (`POST /auth/login`) with credential validation and preserved form inputs on failure. _(commit bffed9d)_
- [x] **T2.3**: Session expiration warning and graceful token refresh/re-login prompt (`SessionExpiryBanner`).
- [x] **T2.4**: Logout action (`POST /auth/logout`) with complete memory purge.
- [x] **T2.5**: HTTP 401 interceptor: clears session vault, preserves user route/state, and redirects to login (`ApiTransport`).

### Milestone 1.3: Participant Dashboard (Console Overview)

- [x] **T3.1**: Repository admission card showing `accessStatus: "verified"`, `reasonCode: "marker-found"`, and last checked timestamp in `Europe/Bucharest`.
- [x] **T3.2**: Live radio ether signal card: current phase (`window`/`static`/`after`), carrier status, station, and local-time countdown.
- [x] **T3.3**: Quick telemetry summary cards: unread news count, unread inbox messages, active stages count.

### Milestone 1.4: Polling Coordinator & Real-Time Sync

- [x] **T4.1**: Polling coordinator for `GET /me/summary` respecting the ~15s interval limit and `Retry-After`.
- [x] **T4.2**: Reactive dependency invalidation: refresh repository card on `repositoryAt`, summary counters, and visibility gating (`useParticipantDashboard`).
- [x] **T4.3**: Origin-wide quiet period handling (`429 jammed` silences all outbound traffic to that origin).

### Milestone 1.5: News Feed (`/news`)

- [x] **T5.1**: Stable, restartable pagination for news list (`GET /news`).
- [x] **T5.2**: News detail viewer (`GET /news` item master-detail) with publication timestamp in user's local timezone.
- [x] **T5.3**: Safe Markdown renderer: strict tag allowlist, no raw server HTML execution, external links forced to `rel="noopener noreferrer"`.

### Milestone 1.6: Inbox & Organizer Communications (`/inbox`)

- [x] **T6.1**: Inbox message list (`GET /inbox`) with unread indicators and category badges.
- [x] **T6.2**: Message detail view with safe body rendering.
- [x] **T6.3**: Explicit "mark as read" action (`POST /inbox/{id}/read`) with optimistic local update.

### Milestone 1.7: Stages & Tournament Briefings (`/stages`)

- [x] **T7.1**: Stages list (`GET /stages`) showing available parts, publication dates, and deadlines.
- [x] **T7.2**: Stage detail view with technical task rendering and errata section.
- [x] **T7.3**: Explicit stage acknowledgment button (`POST /stages/{id}/ack`).

### Milestone 1.8: Ether Roll & Fragment Assembler (`/ether`)

- [x] **T8.1**: Public roll viewer (`GET /ether/roll`) displaying participant airwave sequence (max 1 poll/min).
- [x] **T8.2**: Fragment assembler: collects broadcast letter pieces (`fragment: { n, of, text }`) across accepted frames and reconstructs the full lore message.

### Milestone 1.9: Quality Gate & Accessibility Verification

- [x] **T9.1**: Full test suite coverage for all client state machines, reducers, and error paths.
- [x] **T9.2**: WCAG 2.1 AA audit: keyboard navigation, screen-reader landmarks, focus trap, color contrast, and reduced-motion preferences.
- [x] **T9.3**: Secret scan on client build output (`dist/`) ensuring zero credential leakage in bundles or source maps.

---

## Phase 2: Game Engine, SDK & Battle Bot (Starts 2026-09-28)

Unlocks when organizers publish Part 2 specifications.

- [ ] **T10.1**: Ingest Part 2 OpenAPI schema update and generate TypeScript definitions.
- [ ] **T10.2**: Implement game state parser and game protocol client (Node.js 24+).
- [ ] **T10.3**: Build bot decision engine (heuristic baseline -> strategic decision tree).
- [ ] **T10.4**: Add bot test harness against local mocks and training stand (`stand.zoria.net`).
- [ ] **T10.5**: Setup bot execution workflow / preflight checks in repository.

---

## Phase 3: Game Headquarters & Tournament Stage (2026-10-05 – 2026-10-21)

Unlocks when Part 3/4 specifications are released.

- [ ] **T11.1**: HQ match viewer: visual game board, live telemetry, and replay parser.
- [ ] **T11.2**: Tournament match results & standings tracker.
- [ ] **T11.3**: Group stage preparation & code freeze audit (2026-10-10 00:00 local).
- [ ] **T11.4**: Group stage match monitoring (2026-10-12 – 2026-10-14).
- [ ] **T11.5**: Second stage playoff matches (2026-10-15 – 2026-10-17).
- [ ] **T11.6**: Complete documentation deliverables: `DECISIONS.md` (by 17.10) and `EPISODE.md` (by 18.10).
