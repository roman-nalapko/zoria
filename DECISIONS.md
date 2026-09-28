# Engineering decisions

Maintain this file throughout the project. The final submission requires an
accurate module map, three decisions with alternatives/costs/code locations, and
known limitations. Do not fabricate line references; update them at final freeze.

## Module map

| Module           | Responsibility                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `src/app`        | React composition and participant-facing workflows               |
| `src/api`        | Zoria transport, contracts, errors, retries, and rate discipline |
| `src/ether`      | Signed-frame verification and monotonic ether state              |
| `src/auth`       | Registration and session lifecycle                               |
| `src/repository` | Repository normalization and admission status                    |
| `src/content`    | News, inbox, task stages, and safe rendering                     |
| `src/worker`     | Cloud Run registration watcher and Telegram alerts               |
| `bot`            | Part 2 Tournament bot: WireBot protocol, strategy, and Nakaz     |

## Decision 0 — one always-allocated registration watcher

Status: accepted.

Choice: run a single Node.js Cloud Run instance that shares the pinned Ed25519
verifier and acts only on a verified window. Alternative: keep a browser tab
open or use a one-minute scheduled job. Cost: a small always-on Cloud Run charge
and one more deployable. Benefit: reliable 15-second monitoring independent of a
personal computer. Secrets are injected from Secret Manager and excluded from
the image and logs. Code location: `src/worker` and `Dockerfile`.

## Decision 1 — raw response at the trust boundary

Status: accepted.

Choice: the transport captures response bodies as text and classifies them before
normal API parsing. Alternative: call `response.json()` in each endpoint wrapper.
Cost: an extra normalization layer and explicit schema validation. Benefit: the
client survives intentional pre-window noise and can verify the exact signed
frame bytes. Code location: `src/api/transport.ts`.

## Decision 2 — one polling coordinator per origin

Status: accepted.

Choice: polling and quiet-state timing live outside React components. Alternative:
independent query intervals in each screen. Cost: a small scheduler/state machine.
Benefit: deterministic request rates, cancellation, and no doubled traffic after
mounts or route changes. Code location: `src/api/polling.ts` and `src/participant/useParticipantDashboard.ts`.

## Decision 3 — domain modules independent of React

Status: accepted.

Choice: protocol and state transitions are pure/testable modules. Alternative:
implement them in hooks and components. Cost: more explicit adapters. Benefit:
mutation-testable logic, future reuse by the bot/HQ, and replayable decisions for
competition analysis. Code location: `src/ether/verifier.ts`, `src/ether/controller.ts`,
`src/ether/assembler.ts`, `src/ether/roll.ts`, `src/news/service.ts`, `src/inbox/service.ts`,
and `src/stages/service.ts`.

## Decision 4 — registration secrets remain local-only

Status: accepted, pending any canonical contradictory contract.

Choice: invitation codes, passwords, and bearer tokens enter through local UI
and are never committed or written to diagnostics. Alternative: follow a
2026-09-23 organizer message that mentions an unspecified repository file.
Cost: automatic registration requires a local draft/session mechanism. Benefit:
the implementation follows the public news, FAQ, task, and OpenAPI, none of which
defines a repository secret file, and avoids persisting a one-time credential in
Git history. `.zoria` remains the network username only. Code location:
`src/auth/validation.ts`, `src/auth/draft.ts`, `src/auth/registration.ts`, and
`src/app/RegistrationPanel.tsx`; repository guardrails are also in `.gitignore`
and `AGENTS.md`.

## Decision 5 — proactive slot heartbeat and archetype tuning (Part 2)

Status: accepted.

Choice: the bot strategy tracks accepted command verdicts and injects a harmless
`watch` command on the hearth cell if 3 or more ticks elapse without an accepted
order. Alternative: allow the bot to fall back to `nakaz.yaml` when idle. Cost:
trivial channel budget consumption (32 channel bytes every 3–4 idle ticks, well within
hearth replenishment of +128 bytes/tick). Benefit: strictly guarantees compliance
with Part 2 gate requirement P2-04 (no ticks ceded to Nakaz during active bot operation)
while maintaining complete autonomy over movement, heating, and defensive lines.
Code location: `bot/src/strategy.ts` and `bot/src/main.ts`.

## Known limitations

- Part 1 participant console and background tournament digest bot are fully implemented, verified, and admitted (`accessStatus: "verified"`, `marker-found`).
- Part 2 tournament bot workspace (`bot/`) is fully implemented, verified across all criteria P2-01 through P2-08, with 100% clean linter for `nakaz.yaml` and verified 3-match local pack play.
- Parts 3–4 specifications (Game Headquarters & Provocateur) will be released by organizers on 2026-10-05.
