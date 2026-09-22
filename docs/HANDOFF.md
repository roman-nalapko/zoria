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

## Next recommended change

Implement pure registration input validation next. Normalize a GitHub repository
URL to an exact private repository root, validate the required invitation and
credential fields without retaining secrets in diagnostics, and cover edge cases
before building the form or making a registration request.
