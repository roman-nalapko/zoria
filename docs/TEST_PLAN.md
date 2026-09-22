# Part 1 acceptance plan

## Automated suites

### Transport

- arbitrary non-JSON, empty, HTML, alien JSON, any HTTP status, delayed response,
  mid-body disconnect, and timeout never crash or clear entered data;
- `429` waits for parsed `Retry-After`; `jammed` blocks every request to the
  origin and early wakeups cannot issue traffic;
- retry delay is uniformly sampled from `0..min(60s, 1s * 2^n)` and resets after
  success;
- tokens are absent from URLs, errors, logs, snapshots, and telemetry;
- `X-Request-Id` survives normalized 5xx errors.

### Ether

- official frame A verifies and opens at `2026-09-24T09:00:00Z`;
- official frame B is rejected as a forgery;
- official frame C is rejected without throwing;
- official frame D verifies as a two-entry roll;
- signature verification uses the exact raw `frame` string;
- unknown envelope/frame fields are ignored;
- an older signed frame cannot roll back phase, countdown, window, or roll;
- an unknown key triggers at most one key refresh and remains noise if unknown;
- displayed countdown uses server offset, not a trusted local wall clock.

### Registration and session

- all field boundaries from the specification are tested;
- repository variants normalize to a root, while branch/file/query/hash links
  are rejected before sending;
- lost register response invokes login first and does not create a second account;
- `401` preserves route and form state through login;
- token expiration warning and logout revoke/clear the local session;
- display-name publicity warning is visible before submission.

### Content and repository

- each summary stamp refreshes only its specified resource;
- pagination deduplicates by ID and restarts if data changes during traversal;
- reading a message does not mark it read; explicit action does;
- stage open does not acknowledge it; explicit action does;
- unknown notice renders as ordinary message;
- unsafe HTML is inert and non-HTTP(S) links cannot be opened;
- status reason codes and `verifiedElsewhere` have distinct accessible messages.

## Training-stand checks

Run in one complete UTC hour:

1. Observe noise without crashes or 429 responses.
2. Observe the harbinger from `:20` and verify the countdown.
3. Detect the verified window at `:30`.
4. Register using one of `zoria-stand/station-01..20`.
5. Confirm invitation/`.zoria` instructions and pending repository status.
6. Break the token and confirm login recovery.
7. End at `:50` and confirm the after phase.

Separately force rapid polling once to confirm the client becomes silent for the
entire `Retry-After` period without doubling the jam duration.

## Production go/no-go

- canonical production fingerprint is pinned and independently checked;
- environment visibly says Production;
- registration payload has been reviewed by the user;
- the eligible GitHub repository URL is exact;
- `.zoria` matches the final lowercase network username;
- organizer access is verified and remains present;
- `npm ci && npm run check && npm run build` succeeds from a clean checkout.
