# AI agent handoff

## Start here

1. Read `AGENTS.md`, `docs/STATUS.md`, and `docs/ROADMAP.md`.
2. Run `git status --short --branch` and preserve unrelated changes.
3. Run `npm ci && npm run check` before changing behavior.
4. Work only on a dependency-ready unchecked roadmap item.
5. Update `STATUS.md`, append to `AGENT_LOG.md`, and update roadmap checkboxes.

## Trust model

Before the registration window, every body can be hostile noise. A response is
an ether signal only after its outer envelope shape, pinned key fingerprint, and
Ed25519 signature over the exact raw `frame` string pass. Only then parse the
inner frame. Never infer the phase from an unverified body.

`429` is never noise. `jammed` blocks all requests to that origin until
`Retry-After` expires. Do not “probe” during the quiet period.

## Local-only secrets

No registration secret exists in the repository. When the application code
arrives, collect it through a hidden terminal prompt or user-entered local UI.
Never put it in Git, chat logs, command arguments, screenshots, test fixtures,
or browser URLs. Apply the same rule to passwords and bearer tokens.

On 2026-09-23 the participant relayed an organizer message saying the code should
also be kept in an unspecified repository file. The canonical news, FAQ, task,
and OpenAPI do not define that file; they only define `invitation` in the
registration request, while `.zoria` is explicitly the network username. Do not
invent a path or commit the code. Request clarification if that instruction is
repeated with a concrete file contract.

## Current code seams

- `src/config/environment.ts`: environment validation.
- `src/api/transport.ts`: raw network boundary and jam handling.
- `src/api/errors.ts`: stable API error normalization.
- `src/api/retry.ts`: timing helpers and quiet-period state.
- `src/api/polling.ts`: minimum poll interval ownership.
- `src/ether/verifier.ts`: key/envelope/frame trust boundary.
- `src/ether/state.ts`: monotonic accepted-frame state.
- `src/ether/controller.ts`: sole owner of ether key cache, polling lifecycle,
  retry state, and published snapshots.
- `src/ether/time.ts`: signed server-clock offset and countdown calculations.
- `src/app/runtime.ts`: one transport/controller composition root.
- `src/app/useEther.ts`: React subscription with ref-counted lifecycle.
- `src/auth/validation.ts`: secret-safe field checks and GitHub root
  normalization.
- `src/auth/draft.ts`: explicit-consent persistence of non-secret fields only.
- `src/auth/registration.ts`: window gate, busy retry, and login-first recovery.
- `src/app/RegistrationPanel.tsx`: local secret-entry and submission UI.

## Next recommended change

Implement a redacted in-memory session vault and lift successful registration
state into the application controller. Then show the organizer account, `.zoria`
marker instructions, session expiry, and repository verification next actions.
