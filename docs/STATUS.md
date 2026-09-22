# Current project status

Updated: 2026-09-22 by Codex.

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
- Registration now requires one-time `invitation` and any participant-owned
  private GitHub repository.
- The invitation code has not arrived yet. Organizers said it will be delivered
  through the application channel when useful information begins to pass through
  the ether.
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
- Unit tests for configuration, transport timing, retry behavior, polling, and
  official signed/forged/corrupt control frames. Current suite: 21 tests.

## Immediate next work

1. Implement registration field/repository validation and a local-only draft
   with explicit persistence consent.
2. Implement registration and `authentication-busy` handling without logging
   invitation codes, passwords, tokens, or private response bodies.
3. Add login-first recovery for an uncertain registration response.
4. Add route shell, error boundary, navigation, and accessible status region.
5. Expand malformed-response and official-frame coverage from A–C to A–D.

## External blockers

- One-time application code from Telegram/email.
- Canonical production key fingerprint is still shown as “to be published” in
  the reviewed task text. Production ether must not be trusted without it.
