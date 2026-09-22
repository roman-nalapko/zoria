# Zoria engineering guide

This repository is the participant client for the 2026 Zoria competition. Read
`docs/HACKATHON_BRIEF.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` before
changing product behavior.

## Non-negotiable constraints

- The product is a React + TypeScript application. The future bot must remain
  TypeScript/JavaScript on Node.js 24+.
- Treat all responses before the registration window as untrusted noise unless
  they are a correctly sealed ether envelope.
- Verify an envelope's Ed25519 signature over the exact UTF-8 bytes of its
  `frame` string before parsing `frame` as JSON.
- Never commit passwords, bearer tokens, private keys, session dumps, or real
  `.env` files. Never log authorization headers.
- Browser requests use `credentials: "omit"` and bearer authorization.
- Respect `Retry-After`. After `429 jammed`, send no request to that API origin
  until the quiet period ends. Retrying early doubles the penalty.
- `/ether` may be polled at most every 15 seconds, `/ether/roll` at most every
  minute, and `/me/summary` approximately every 15 seconds.
- Unknown response fields and unknown notice types are forward-compatible and
  must not crash the client.
- Render server Markdown through a strict allowlist. Never execute server HTML.
- Display UTC server dates in the user's local time zone and label that zone.

## Working method

1. Check `git status` and preserve unrelated user changes.
2. Pick the next unchecked, dependency-ready item from `docs/ROADMAP.md`.
3. Prefer domain modules and pure functions over logic inside React components.
4. Add or update tests for protocol, state, timing, and error behavior.
5. Run `npm run check` before declaring a task complete.
6. Update `docs/ROADMAP.md` and `DECISIONS.md` when behavior or architecture
   changes.
7. Keep `docs/STATUS.md` current and append a dated entry to
   `docs/AGENT_LOG.md` so another agent can continue without chat history.

## Definition of done

- TypeScript passes in strict mode.
- Unit/component tests pass and cover the changed failure paths.
- Formatting and linting pass.
- No secret or real account data is added.
- User-facing failure messages preserve form state and include `X-Request-Id`
  for server failures when available.
- Any newly discovered requirement is linked to its source URL and recorded in
  the brief or roadmap.

## Useful commands

```bash
npm ci
npm run dev
npm run check
npm run test:watch
npm run generate:api
```

Use the training API by default during development:
`https://stand.zoria.net/api/v1`. Production must be an explicit environment
choice, never a source edit.
