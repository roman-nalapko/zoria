# Agent work log

Append new entries; do not rewrite history. Include decisions, changed files,
verification commands, remaining risks, and the exact next action. Never record
secrets, tokens, invitation codes, passwords, or private response bodies.

## 2026-09-25 — Window verified; registration completed by live watcher

- Live verification of production ether endpoint: Ed25519 signature passed against
  pinned fingerprint `dcb3155eb8f2538d466a294315e984fa9f67f703556c5e276d5b3afc88895696`.
- Phase is WINDOW: `opensAt: 2026-09-25T05:00:00.000Z`, `closesAt: 2026-09-25T17:00:00.000Z`
  (08:00 to 20:00 Europe/Bucharest).
- GitHub Actions watcher run 36082418867 detected window at 05:02:40 UTC (Check 22),
  performed registration with session identity validation, delivered Telegram alert,
  and auto-disabled workflows (both live and scheduled) at 05:02:42 UTC to avoid
  consuming further Actions minutes.
- Verified repository permissions via GitHub API: `zoria-net-bot` is confirmed as a
  collaborator with `Write` access on `roman-nalapko/zoria`.
- Checked /me/repository via authenticated run 36101283072: server confirmed
  `accessStatus: "verified"`, `reasonCode: "marker-found"`. Telegram alert delivered.
- Admission deadline of October 5 is fully met and confirmed.
- Next action: build part 1 client UI and in-memory authenticated session state.

## 2026-09-24 — P0 R1–R6 and P1 R7–R12 reliability fixes (Antigravity)

- Confirmed live job 36024289951 was in_progress at session start (16:00 UTC start,
  still running at 19:50 UTC). No verified window frame received; registration and
  admission remain UNCONFIRMED as of this session.
- R1: Removed throw from once.ts; added bounded jitter retry for 5xx/transport
  errors in retryAuthBusyAndTransient(); shell `|| true` prevents bash -e exit.
- R2: zoria.ts login()/register() now parse JSON body, require non-empty token
  and username match; return sessionValid: boolean. HTML 200 is no longer treated
  as success.
- R3: Created src/worker/state-file.ts — persists latestFrameAt and quietUntil
  between once.js invocations. ZoriaWorkerClient gains applyState()/exportState().
- R4: Comprehensive uncertain registration recovery in once.ts: 409→login,
  5xx→login recovery, malformed 200→login-first. Only re-register after definitive
  invalid-credentials AND confirmed window.
- R5: Workflow dispatches successor on second-to-last iteration (overlap not gap).
  ZORIA_MAX_CHECKS env var added.
- R6: Budget comment and ZORIA_MAX_CHECKS documented in workflow.
- R7: Rich Telegram messages with frame timestamp, opensAt, countdown, timezone.
  Fixed "after" phase text (was incorrectly saying "not yet open").
- R8: TelegramNotifier requires fixed TELEGRAM_CHAT_ID; removed auto-discovery;
  added retry_after parsing and bounded retries; pending success notification queue.
- R9: getRepositoryStatus() added in zoria.ts; bearer token threading is a future
  step (excluded from SafeApiResult for safety).
- R10: Harbinger.text type accepts {uk,en} (addendum) and {uk,ru} (training) via
  optional keys. Added 7 new robustness tests.
- R11: Training stand test noted as skip-able (requires STAND-2026 env).
- R12: Git history audited with grep; no real secret values found.
- Verification: npm run check passed 20 files / 89 tests. No secrets added.
- Changed files: src/worker/once.ts, zoria.ts, telegram.ts (all rewritten);
  new: src/worker/state-file.ts, zoria.test.ts, telegram.test.ts, state-file.test.ts;
  updated: src/ether/verifier.ts, verifier.test.ts, time.test.ts, App.test.tsx;
  updated: .github/workflows/zoria-watch-live.yml.
- Next action: merge codex/zoria-agent-foundation to main, dispatch new watcher job,
  monitor Telegram delivery and registration.

## 2026-09-24 — Cloud registration watcher

- Added a Node.js 24 worker and container for one always-on Cloud Run instance.
- The worker verifies the pinned production Ed25519 envelope before acting,
  respects the 15-second poll floor and `Retry-After`, performs a login-first
  idempotency check, and sends Telegram alerts without logging secrets.
- Secrets are environment-only and intended for Google Secret Manager.
- Next action: deploy to the selected Google Cloud project with one minimum and
  maximum instance and CPU throttling disabled.

## 2026-09-24 — Zero-budget watcher fallback

- Added a GitHub Actions watcher that performs one signed ether check every five
  minutes and never submits without a verified window.
- On success it delivers the Telegram result and disables its own workflow to
  avoid consuming further Actions minutes.
- The workflow requires three GitHub Actions secrets and must be merged to the
  default branch before schedules run.
- Updated the active schedule to ten minutes with a Telegram status message on
  every check, while preserving the immediate success notification and
  self-disable behavior.
- GitHub did not create scheduled runs promptly, so replaced cron with a
  continuously running job that checks every ten minutes and dispatches a
  successor before the six-hour Actions limit.
- Persisted the private Telegram chat ID as an Actions secret and made status
  delivery failures non-fatal so Telegram cannot stop registration monitoring.

## 2026-09-21 — foundation

- Reviewed part 1 task, client specification, OpenAPI, scoring, calendar, and
  addenda.
- Created React + TypeScript/Vite foundation, strict checks, CI, architecture,
  roadmap, test plan, and competition-required writing templates.
- Created private GitHub repository and branches; invited no external users yet.
- Verification: `npm run check`, `npm run build`, and GitHub CI passed.

## 2026-09-22 — registration contract and repository admission

- Detected official contract revision 1.1.0: registration requires a one-time
  application code; the repository can be any participant-owned private repo.
- Replaced the pinned OpenAPI file and regenerated `src/api/schema.d.ts`.
- Added `.zoria` with `roman-nalapko` and sent `zoria-net-bot` a Write invitation.
- Added a quiet thread monitor for official ether/news changes.
- Verification: local quality gate/build and GitHub CI passed.

## 2026-09-22 — protocol foundation

- Added typed, validated environment configuration.
- Added raw-response transport, normalized API errors, Retry-After handling,
  full-jitter backoff, origin-wide jam quiet state, and poll interval controls.
- Added fingerprint/key checks, Ed25519 envelope verification, strict frame
  parsing, and monotonic state reduction.
- Added deterministic tests including official control frames A–C.
- Added `STATUS.md` and `HANDOFF.md` for cross-agent continuity.
- Verification: `npm run check` passed 7 files / 14 tests; `npm run build`
  passed. No secrets were added.
- Next action: implement the single-owner ether application controller described
  in `HANDOFF.md`.

## 2026-09-22 — live ether controller and receiver UI

- Added the single-owner ether controller, pinned training key cache, verified
  frame reduction, Retry-After scheduling, failure backoff, and ref-counted
  lifecycle that prevents duplicate React pollers.
- Added React composition/subscription, local-time server-offset calculations,
  trusted phase/countdown telemetry, and non-secret diagnostics.
- Browser QA found and fixed unbound native `setTimeout` and `fetch` calls that
  unit tests did not reproduce. The page now renders and reaches the training
  API; its current `stopping` response is presented as a connection diagnostic.
- Verification: `npm run check` passed 9 files / 21 tests; `npm run build`
  passed; local browser render and accessibility tree were inspected.
- No invitation code, password, token, or private response body was recorded.
- Next action: implement pure registration/repository input validation, then the
  consent-aware local draft described in `HANDOFF.md`.

## 2026-09-23 — registration clarification and FAQ review

- Reviewed the official news, FAQ, part 1 task, and OpenAPI after the participant
  relayed an organizer update.
- Confirmed that canonical sources define the one-time code only as the
  `invitation` field of `POST /auth/register`; `.zoria` contains the network
  username. No official source defines a repository file for the invitation.
- Kept all real registration secrets local-only and recorded the contradictory,
  unspecified “file in the repository” sentence as awaiting clarification.
- Recorded the official instruction to contact organizers if the code has not
  arrived by 2026-09-23, plus the public training code `STAND-2026` and current
  own-repository training flow.
- No invitation code, password, token, or private response body was received or
  recorded.
- Next action remains pure registration/repository validation and a
  consent-aware local draft.

## 2026-09-24 — production trust pin and guarded registration

- Pinned the canonically published production Ed25519 fingerprint and removed
  the need for an operator-supplied trust override.
- Added exact GitHub repository-root normalization and validation for every
  registration field without echoing secret values in errors.
- Added an explicit-consent browser draft that can persist username, display
  name, repository, and language, but structurally cannot persist the invitation
  or password.
- Added registration with a verified-window gate, bounded
  `authentication-busy` Retry-After retries, strict session parsing, and
  login-first recovery after a lost/uncertain response.
- Added the production registration form. The invitation and password stay only
  in component memory and are cleared after success.
- Verification: `npm run check` passed 12 files / 27 tests; `npm run build`
  passed; production browser QA confirmed the canonical trust pin, verified
  static ether frame, empty secret fields, and disabled submission gate.
- The real invitation value was not written to source, tests, docs, storage, or
  command output.
- Next action: add the in-memory session vault and repository next-step screen,
  then register only after a verified production `window` frame.

## 2026-09-24 — Reliability audit and Antigravity handoff

- Read official news, FAQ, task, client specification, calendar and addenda.
- Verified private repo, pending bot invitation and .zoria on main. Fresh ether
  at 19:10:17 UTC was unverified noise; current phase remains undetermined.
- Reproduced worker accepting mock HTML HTTP 200 as a successful login.
- Found fatal API-error paths, state loss between checks, incomplete uncertain
  registration recovery, unproven job handover and unknown Actions budget.
- npm run check passed 14 files / 33 tests, which do not cover full worker flow.
- Recorded all findings and acceptance criteria as R1–R12 plus remaining client
  work in docs/REGISTRATION_BACKLOG.md; added docs/ANTIGRAVITY_PROMPT.md.
- Corrected stale STATUS/HANDOFF readiness claims. No production code, workflow,
  secrets or running jobs changed during this handoff. Defects remain open.
- Next agent: check live job first, then implement backlog P0 and verify rollout.

## 2026-09-25 — Phase 1 Client Implementation (Milestones 1.1, 1.2, 1.3, 1.4)

- Admission and registration confirmed live: verified admission status with `marker-found`.
- Implemented Milestone 1.1 (Shell & Routing):
  - Responsive AppShell navigation with active link highlighting, environment badge, and user details.
  - Route architecture with `react-router-dom`: `/login`, `/dashboard`, `/news`, `/inbox`, `/stages`, `/ether`.
  - Global Error Boundary with state reset.
- Implemented Milestone 1.2 (Authentication & Session Vault):
  - In-memory session vault (`src/auth/session-vault.ts`): bearer tokens never touch localStorage or logs.
  - `SessionProvider` React context mirroring vault state to components via subscriber callbacks.
  - `LoginPage` form with validation and redirect to `/dashboard`.
  - `SessionExpiryBanner`: alerts participants when session expiry is <= 10m or expired.
  - Server logout: `POST /auth/logout` with complete memory purge.
  - HTTP 401 interceptor in `ApiTransport`: auto-clears vault on unexpected 401 responses.
- Implemented Milestone 1.3 & 1.4 (Participant Dashboard & Polling Integration):
  - Repository admission card with live status (`verified`), reason code (`marker-found`), and Europe/Bucharest timestamp formatting.
  - Direct repository link to GitHub with verified status indicator.
  - Ether receiver telemetry card with phase, countdown, and key fingerprint.
  - Tournament overview counters: unread news, inbox, released stages, acknowledged stages.
  - Background polling hook (`useParticipantDashboard`) syncing `/me/summary` every 60s, pausing on hidden document visibility, and invalidating repository data on `repositoryAt` change.
- Quality Gate: `npm run check` passes completely (25 test files, 116 tests, 0 lint warnings, 0 type errors).
- Implemented Milestone 1.5 (News Feed `/news`):
  - Safe Markdown parser (`SafeMarkdown.tsx`): sanitized link targets, code blocks, lists, quotes, without executing raw server HTML.
  - News service (`src/news/service.ts`) with stable restartable pagination (`limit`, `offset`).
  - Master-detail News page (`src/app/NewsPage.tsx`) with published timestamp in local timezone.
- Implemented Milestone 1.6 (Participant Inbox `/inbox`):
  - Inbox service (`src/inbox/service.ts`) with `GET /inbox`, `GET /inbox/{id}`, and `POST /inbox/{id}/read`.
  - Inbox page (`src/app/InboxPage.tsx`) with unread indicators, repository notice badges, full letter viewer, and optimistic mark-as-read acknowledgment action.
- Quality Gate: `npm run check` passes completely (30 test files, 133 tests, 0 lint warnings, 0 type errors).
- Implemented Milestone 1.7 (Tournament Stages `/stages`):
  - Stages service (`src/stages/service.ts`) with `GET /stages` (`fetchStages`), `GET /stages/{id}` (`fetchStage`), and `POST /stages/{id}/ack` (`acknowledgeStage`).
  - Stages view (`src/app/StagesPage.tsx`) with released parts master-list, pending/acknowledged pills, full technical specification Markdown body, official errata notices (`errata`, `errataAt`), and immediate acknowledgment action.
  - Wired into `App.tsx` routing and added dedicated styling in `styles.css`.
- Quality Gate: `npm run check` and `npm run build` pass completely (32 test files, 138 tests, 0 lint warnings, 0 type errors).
