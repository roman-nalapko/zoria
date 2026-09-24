# Current project status

Updated: 2026-09-23 by Codex.

This is the canonical short handoff. Read it before `AGENT_LOG.md`; update both
after every meaningful implementation session.

## Repository

- GitHub: `https://github.com/roman-nalapko/zoria` (private).
- Default branch: `main`.
- Active development branch: `codex/zoria-agent-foundation`.
- `.zoria`: `roman-nalapko`, present on both branches.
- `zoria-net-bot`: Write invitation sent on 2026-09-22; acceptance is pending.
- CI: formatting, ESLint, strict TypeScript, Vitest, and production build.

## Official contract

- OpenAPI 3.1 revision: 1.1.0, published 2026-09-22.
- Production Ed25519 fingerprint was published and pinned on 2026-09-23.
- Registration now requires one-time `invitation` and any participant-owned
  private GitHub repository.
- The invitation code arrived on 2026-09-24. Its value is deliberately absent
  from the repository and documentation; enter it only in the local form.
- Official news now says to contact the organizers through the original
  application channel if the code has not arrived by 2026-09-23.
- A separate organizer message says to save the code in an unspecified
  repository file. No canonical page defines such a file; news, FAQ, task, and
  OpenAPI only define the `invitation` request field. Do not commit it pending an
  explicit canonical clarification. `.zoria` continues to contain only the
  network username.
- Never commit or paste the invitation code, password, or bearer token.

## Implemented

- Project/tooling foundation and generated OpenAPI TypeScript declarations.
- Validated training/production environment configuration.
- Raw response transport with `credentials: "omit"`, timeout, bearer injection,
  request ID capture, and origin-wide jam quiet state.
- Retry-After parsing and full-jitter backoff helpers.
- Poll frequency coordinator.
- Ether key fingerprint verification, Ed25519 envelope verification, strict
  frame parsing, and monotonic frame reduction.
- Single-owner ether controller with key caching, minimum polling intervals,
  Retry-After quiet periods, failure backoff, and ref-counted React lifecycle.
- Live receiver screen with trusted phase, server-adjusted countdown, local
  time zone, signal diagnostics, and pinned-key visibility.
- Registration validation, exact GitHub repository-root normalization, and a
  consent-aware draft that persists only non-secret fields.
- Window-gated registration with `authentication-busy` Retry-After handling and
  login-first recovery after an uncertain response.
- Unit tests for configuration, transport timing, retry behavior, polling, and
  official signed/forged/corrupt control frames. Current suite: 27 tests.

## Immediate next work

1. Keep the production client running; enter the invitation and a password only
   in the local form, then submit after a verified `phase: window` frame.
2. Add the redacted in-memory session vault and authenticated screen state.
3. Show repository invitation/marker instructions immediately after success.
4. Add route shell, error boundary, navigation, and accessible status region.
5. Expand malformed-response and official-frame coverage from A–C to A–D.

## External blockers

- Clarification of the organizer message about an unspecified repository file,
  if they truly intend anything beyond the `invitation` request field.
- The registration window has not yet appeared in a verified ether frame.
- Canonical production key fingerprint is still shown as “to be published” in
  the reviewed task text. Production ether must not be trusted without it.
