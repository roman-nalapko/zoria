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

## Decision 1 — raw response at the trust boundary

Status: accepted.

Choice: the transport captures response bodies as text and classifies them before
normal API parsing. Alternative: call `response.json()` in each endpoint wrapper.
Cost: an extra normalization layer and explicit schema validation. Benefit: the
client survives intentional pre-window noise and can verify the exact signed
frame bytes. Code location: to be added.

## Decision 2 — one polling coordinator per origin

Status: accepted.

Choice: polling and quiet-state timing live outside React components. Alternative:
independent query intervals in each screen. Cost: a small scheduler/state machine.
Benefit: deterministic request rates, cancellation, and no doubled traffic after
mounts or route changes. Code location: to be added.

## Decision 3 — domain modules independent of React

Status: accepted.

Choice: protocol and state transitions are pure/testable modules. Alternative:
implement them in hooks and components. Cost: more explicit adapters. Benefit:
mutation-testable logic, future reuse by the bot/HQ, and replayable decisions for
competition analysis. Code location: to be added.

## Known limitations

- The current repository is a prepared foundation, not a complete part 1 client.
- The production Ed25519 fingerprint was not visible in the canonical task text
  when this foundation was created and must be pinned before production use.
- Parts 2–4 are intentionally not guessed because they are released through the
  participant network on their scheduled dates.
