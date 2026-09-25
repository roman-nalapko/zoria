# Current project status

Updated: 2026-09-25 by Antigravity (16:50 Europe/Bucharest / 13:50 UTC).

This is the canonical short handoff. Read it before `AGENT_LOG.md`; update both
after every meaningful implementation session.

## September 25 — Phase 0 & Phase 1 100% COMPLETE ✅

- **Cryptographically verified window**: Opened at `2026-09-25T05:00:00.000Z`
  (08:00 Europe/Bucharest); closes at `2026-09-25T17:00:00.000Z` (20:00 Europe/Bucharest).
  Key fingerprint: `dcb3155eb8f2538d466a294315e984fa9f67f703556c5e276d5b3afc88895696`.
- **Repository admission status (CONFIRMED VERIFIED)**:
  - `accessStatus: "verified"`, `reasonCode: "marker-found"`.
  - Confirmed via authenticated `GET /me/repository`.
  - `zoria-net-bot` is confirmed as a `Write` collaborator on `roman-nalapko/zoria`.
  - `.zoria` contains `roman-nalapko`.
  - Official admission deadline of October 5 is fully met and verified.
- **Participant Inbox Acknowledged**:
  - Official confirmation notice received and marked read via `POST /inbox/{id}/read` (200 OK).
  - Unread letter count is `0`.
- **Part 1 Client Complete (Milestones 1.1–1.9)**:
  - Shell, responsive navigation, and accessible live ARIA announcer.
  - In-memory credential vault (`SessionContext`, `session-vault.ts`).
  - Participant Dashboard with 15s summary polling and reactive invalidation.
  - News Feed with pagination and safe Markdown rendering.
  - Inbox with message inspection and optimistic read acknowledgment.
  - Stages viewer with errata tracking and acknowledgment.
  - Ether receiver, countdown clock, public roll viewer, and fragment assembler.
  - Quality Gate: 31 test files, 120 tests (100% passing), 0 lint errors, strict typecheck clean.
- **Automated Telegram Monitoring**:
  - `zoria-check-digest.yml` active in GitHub Actions, scheduled every 4 hours.
  - Reports summary counters, unread message titles, news timestamps, and repository status.

## Repository

- GitHub: `https://github.com/roman-nalapko/zoria` (private).
- Default branch: `main` (clean and fully pushed).
- `.zoria`: `roman-nalapko`.
- `zoria-net-bot`: Collaborator (Write access confirmed).
- CI: All tests passing.

## Upcoming Tournament Milestones

1. **2026-09-26 12:00 (Europe/Bucharest)**: Verifiable Draw (drand beacon + participant permutation).
2. **2026-09-28**: Release of **Part 2** (Game engine, SDK, tournament bot protocol).
   - Ingest OpenAPI updates from `/stages`.
   - Implement bot decision engine and local test harness.
