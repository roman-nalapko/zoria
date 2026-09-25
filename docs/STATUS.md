# Current project status

Updated: 2026-09-25 by Antigravity (08:58 Europe/Bucharest / 05:58 UTC).

This is the canonical short handoff. Read it before `AGENT_LOG.md`; update both
after every meaningful implementation session.

## September 25 — Window active; registration completed by watcher

- **Cryptographically verified window**: Opened at `2026-09-25T05:00:00.000Z`
  (08:00 Europe/Bucharest); closes at `2026-09-25T17:00:00.000Z` (20:00 Europe/Bucharest).
  Key fingerprint: `dcb3155eb8f2538d466a294315e984fa9f67f703556c5e276d5b3afc88895696`.
- **Live watcher execution**:
  - Run 36082418867 on `main` detected the signed `window` frame at check 22
    (05:02:40 UTC / 08:02:40 local).
  - Executed registration/login with session identity validation (`sessionValid: true`).
  - Sent success notification to Telegram.
  - Automatically disabled `zoria-watch-live.yml` and `zoria-watch.yml` at 05:02:42 UTC
    to halt Actions minute consumption.
  - Job finished with status `success`.
- **Repository admission status (CONFIRMED VERIFIED)**:
  - `accessStatus: "verified"`, `reasonCode: "marker-found"`.
  - Confirmed via authenticated `GET /me/repository` call in run 36101283072.
  - `zoria-net-bot` is confirmed as a `Write` collaborator on `roman-nalapko/zoria`.
  - `.zoria` contains `roman-nalapko`.
  - Official admission deadline of October 5 is fully met and verified.

## Repository

- GitHub: `https://github.com/roman-nalapko/zoria` (private).
- Default branch: `main`.
- Active development branch: `codex/zoria-agent-foundation`.
- `.zoria`: `roman-nalapko`.
- `zoria-net-bot`: Collaborator (Write access confirmed).
- CI: All tests passing (20 test files / 89 tests).

## Implemented

- All P0 (R1–R6) and P1 (R7–R12) reliability fixes merged to `main`.
- Non-secret persistent timing state in `dist-worker/worker-state.json`.
- Strict session identity verification in `zoria.ts`.
- Bounded jitter backoff and no-throw error handling in `once.ts`.
- Fixed Telegram destination, retry_after support, and pending delivery queue.
- Harmonized `{uk, en}` Harbinger types per September 24 addendum.
- Overlap successor chaining in GitHub Actions workflow.

## Immediate next work

1. Confirm Telegram delivery in user's Telegram chat.
2. Build authenticated in-memory session vault and UI routes for Part 1 client.
3. Add repository status poller (`/me/repository`) to track `accessStatus: verified`.
4. Summary, news, inbox and released-stage polling.
