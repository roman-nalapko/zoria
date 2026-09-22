# Agent work log

Append new entries; do not rewrite history. Include decisions, changed files,
verification commands, remaining risks, and the exact next action. Never record
secrets, tokens, invitation codes, passwords, or private response bodies.

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
