# Zoria client

Participant client and future game headquarters for the 2026 Zoria competition.
The application is intentionally prepared as a React + TypeScript foundation;
implementation work is tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Start

Requirements: Node.js 24+ and npm 11+.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The default environment points to the hourly-resetting training stand. To use
production, set `VITE_ZORIA_API_URL=https://zoria.net/api/v1` explicitly.

## Quality gate

```bash
npm run check
```

This runs formatting checks, linting, strict TypeScript checks, and tests. The
same gate runs in GitHub Actions.

## Repository admission

Before the admission deadline:

1. Obtain the one-time application code delivered by the organizers via the
   email or Telegram account used in the application.
2. Register during the randomly opened window using that code and this private
   repository.
3. Invite the account returned by `GET /public/config` (currently
   `zoria-net-bot`).
4. Create `.zoria` in the default branch with the network username on its first
   non-empty line. `.zoria.example` is only a placeholder and does not satisfy
   admission.
5. Wait until `GET /me/repository` reports `accessStatus: "verified"`.

The repository must remain private during the season. Do not add `.zoria` until
the final network username is known.

## Project map

- `AGENTS.md` — operating rules for Codex and other coding agents.
- `docs/HACKATHON_BRIEF.md` — concise requirements, dates, and scoring.
- `docs/ARCHITECTURE.md` — planned boundaries and protocol invariants.
- `docs/ROADMAP.md` — dependency-ordered implementation backlog.
- `docs/TEST_PLAN.md` — acceptance matrix from the official specification.
- `docs/api/part1.openapi.yaml` — official OpenAPI 3.1 contract.
- `DECISIONS.md` — competition-required engineering record.

Primary sources: [part 1 task](https://zoria.net/spec/part1/tz/),
[client specification](https://zoria.net/spec/client/),
[OpenAPI](https://zoria.net/spec/openapi/),
[FAQ](https://zoria.net/faq/),
[scoring](https://zoria.net/scoring/), and
[calendar](https://zoria.net/calendar/).
