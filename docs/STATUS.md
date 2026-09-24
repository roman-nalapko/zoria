# Current project status

Updated: 2026-09-24 by Antigravity (22:50 UTC+3 = 19:50 UTC).

This is the canonical short handoff. Read it before `AGENT_LOG.md`; update both
after every meaningful implementation session.

## September 24 — P0 + P1 reliability fixes applied

All backlog items R1–R12 have been addressed. See `docs/REGISTRATION_BACKLOG.md`
for the original audit. Changes are committed to `codex/zoria-agent-foundation`
and must be merged to `main` to take effect in the live watcher.

Live job 36024289951 was still running at audit time (16:00 UTC start). Current
phase and registration success remain UNCONFIRMED from this session — no verified
window frame was observed. The watcher must receive a genuine signed `window`
frame and confirm a valid session for the configured username before reporting
registration success.

## Repository

- GitHub: `https://github.com/roman-nalapko/zoria` (private).
- Default branch: `main`.
- Active development branch: `codex/zoria-agent-foundation`.
- `.zoria`: `roman-nalapko`, present on both branches.
- `zoria-net-bot`: Write invitation sent on 2026-09-22; acceptance pending.
- CI: formatting, ESLint, strict TypeScript, Vitest, and production build.
- Actions quota: unknown. Estimated ~355 min/job; budget for ~5 jobs/month.

## Implemented (this session — P0+P1 fixes)

- **R1** — `once.ts` no longer `throw`s on transient failures; bounded jitter
  retries for 5xx/transport errors in `retryAuthBusyAndTransient()`.
- **R2** — `zoria.ts login()` and `register()` validate session body: require
  non-empty token field and matching username; return `sessionValid: boolean`.
- **R3** — `state-file.ts` persists `latestFrameAt` and `quietUntil` across
  `once.js` restarts; applied via `applyState()`/`exportState()`.
- **R4** — Comprehensive uncertain registration recovery: 409→login, 5xx→login,
  malformed 200→login-first; only re-register after definitive invalid-credentials.
- **R5** — Workflow dispatches successor on second-to-last iteration (overlap
  not gap); `|| true` on `node once.js` prevents shell `-e` exit.
- **R6** — Budget comment in workflow; `ZORIA_MAX_CHECKS` env supported.
- **R7** — Rich Telegram messages with frame timestamp, local time (Europe/Bucharest),
  opensAt countdown; "after" text fixed.
- **R8** — `telegram.ts` requires fixed `TELEGRAM_CHAT_ID`; auto-discovery removed;
  `retry_after` parsing; bounded retries; pending success notification queue.
- **R9** — `zoria.ts getRepositoryStatus()` added; session token threading is
  noted as a future step (token intentionally excluded from `SafeApiResult`).
- **R10** — `Harbinger.text` accepts `{uk,en}` (addendum) and `{uk,ru}` (training)
  via optional keys; R10 robustness tests added (7 new tests).
- **R11** — Training stand integration test is skip-able (needs env with STAND-2026).
- **R12** — Git history audited; no real secret values found in source/test files.

## Test suite

`npm run check` passes: **20 test files / 89 tests** (was 14 files / 33 tests).
New tests cover: session validation (R2), state persistence (R3), Telegram
retry/chatId/pending (R8), frame robustness/backward-compat (R10).

## Immediate next work

1. Merge `codex/zoria-agent-foundation` to `main` and trigger watcher dispatch.
2. Monitor new job; verify Telegram delivery and registration confirmation.
3. Implement bearer token threading to complete /me/repository check (R9).
4. Add in-memory session vault and authenticated screen state.
5. Show repository invitation/marker instructions after success.

## External blockers

- Registration success requires a cryptographically verified `window` frame;
  no such frame was observed during this session.
- Actions quota unknown; monitor at https://github.com/settings/billing.
- Bot invitation acceptance still pending (sent 2026-09-22).
