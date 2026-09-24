# Architecture

## Direction

Build a thin UI over testable domain modules. React renders state and dispatches
commands; protocol, scheduling, parsing, cryptography, and persistence do not
depend on React. This keeps part 1 safe and lets the same event/state model grow
into the scored replay headquarters in part 3.

```text
React routes and views
        |
application controllers / queries
        |
domain state machines and normalized entities
        |
transport | ether verifier | session vault | clock | storage
        |
training or production Zoria API
```

## Planned modules

- `src/config`: validated API origin and build-time settings.
- `src/api`: generated OpenAPI types, a narrow request client, error
  normalization, pagination, backoff, and origin-wide quiet state.
- `src/ether`: key pinning, envelope shape checks, Ed25519 verification, frame
  parsing, monotonic-frame reducer, harbinger clock, and fragment collection.
- `src/auth`: registration/login/logout, lost-response recovery, session expiry,
  and a replaceable session vault.
- `src/repository`: URL normalization and repository-status presentation.
- `src/content`: news, inbox, stages, safe Markdown, read/ack actions.
- `src/app`: routes, screens, accessibility, and application composition.
- `src/test`: deterministic clocks, fake transport, official control frames,
  malformed-response corpus, and fixtures.

## State boundaries

Persist only user-approved preferences, the API environment, and optionally the
session/draft. Never persist secrets to source-controlled files. The bearer token
must be injected at the transport boundary and redacted from every diagnostic.

Keep server state normalized by ID. `GET /me/summary` drives invalidation:

| Changed summary field | Refresh            |
| --------------------- | ------------------ |
| `unread`              | inbox, then stages |
| `latestNews`          | news               |
| `releasedStages`      | stages             |
| `repositoryAt`        | repository status  |

## Request pipeline

1. Check the origin-wide quiet deadline.
2. Construct an abortable request with `credentials: "omit"`.
3. Capture status, headers, and body as text without assuming JSON.
4. If `429`, parse `Retry-After`, update quiet state, and schedule safely.
5. Before the window, classify a sealed envelope before interpreting any body as
   a normal API response.
6. Normalize known API errors without deleting form input.
7. Retry transport and unsealed 5xx failures with full jitter capped at 60 s.
8. Attach `X-Request-Id` to diagnostics and user-visible server-failure reports.

Timers and requests need explicit owners and cancellation. There must be one
polling coordinator per API origin, preventing duplicate React mounts from
multiplying traffic.

The implemented composition root creates one transport and one `EtherController`.
React consumes immutable controller snapshots through `useSyncExternalStore`;
subscriber retention starts and stops a single timer, including under development
StrictMode. Countdown rendering uses the signed frame clock offset and a local
display-only one-second ticker, never an extra network poll.

## Ether trust boundary

The verifier accepts raw response text and pinned key metadata and returns one of
`signal`, `stale-signal`, or `noise`; it never throws for attacker-controlled
input. Its sequence is fixed:

1. Parse only the outer envelope shape.
2. Match key ID to a fingerprint-pinned public key.
3. Verify Ed25519 over UTF-8 bytes of the exact `frame` string.
4. Parse and validate the frame (`v === 1`, `station === "zoria"`).
5. Compare `at` with the newest accepted frame.

The production fingerprint is configuration, not learned trust. Key rotation
requires a canonical erratum/news update plus an explicit code/config change.

## Registration watcher deployment

`src/worker` is a Node.js 24 Cloud Run worker for the time-critical registration
window. It shares the production-key verifier, polls no faster than once every
15 seconds, and attempts authentication or registration only after a verified
`phase: "window"` frame. Cloud Run injects the invitation, password, and
Telegram token from Secret Manager; they are never part of the image or source
tree. The deployment must use exactly one always-allocated instance.

For a short-lived, zero-budget fallback,
`.github/workflows/zoria-watch-live.yml` runs continuously for about five hours
and forty minutes, checking once every ten minutes, then dispatches its successor
before exiting. This avoids GitHub cron latency. After confirmed registration
and a delivered success message, it disables both watcher workflows.

## UI routes

- `/` — connection status, phase, countdown, and next required action.
- `/register` and `/login` — forms with preserved state and inline errors.
- `/repository` — invitation, `.zoria`, status, reason, and warning states.
- `/news`, `/inbox`, `/stages`, `/stages/:id` — network content.
- `/ether` — signal diagnostics, public roll, and reconstructed fragments.
- `/settings` — API environment, language, local time zone, and session policy.

Use semantic landmarks, keyboard access, visible focus, reduced-motion support,
and status announcements. Server text may be Ukrainian or English; client chrome
should be prepared for localization.

## Future seams

Do not invent parts 2–4. Reserve boundaries for a Node bot package, shared game
protocol types, append-only match telemetry, replay indexes, presets, and HQ
drivers. Add them only after the released stage text is stored in the repository.
