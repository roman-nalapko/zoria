# Agent work log

Append new entries; do not rewrite history. Include decisions, changed files,
verification commands, remaining risks, and the exact next action. Never record
secrets, tokens, invitation codes, passwords, or private response bodies.

## 2026-09-24 — Cloud registration watcher

- Added a Node.js 24 worker and container for one always-on Cloud Run instance.
- The worker verifies the pinned production Ed25519 envelope before acting,
  respects the 15-second poll floor and `Retry-After`, performs a login-first
  idempotency check, and sends Telegram alerts without logging secrets.
- Secrets are environment-only and intended for Google Secret Manager.
- Next action: deploy to the selected Google Cloud project with one minimum and
  maximum instance and CPU throttling disabled.

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
