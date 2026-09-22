# Delivery roadmap

Checkboxes are the work queue for coding agents. A task is complete only when its
tests and the repository quality gate pass.

## P0 — foundation

- [x] Capture official part 1 requirements, architecture, test plan, and OpenAPI.
- [x] Scaffold React + TypeScript, strict checks, tests, formatting, and CI.
- [x] Generate TypeScript API types from the pinned OpenAPI contract.
- [x] Implement validated environment switching (training by default,
      production explicit).
- [ ] Add route shell, error boundary, accessible navigation, and status region.

## P1 — safe transport and ether

- [x] Implement raw-response transport with timeout/abort and `credentials: omit`.
- [x] Normalize headers, API errors, arbitrary bodies, and request IDs.
- [x] Implement shared `Retry-After` quiet state and full-jitter retry scheduling.
- [x] Add a singleton polling coordinator with `/ether` and `/ether/roll` limits.
- [ ] Pin the published production fingerprint once it appears in canonical docs.
- [x] Implement key import/fingerprint verification and Ed25519 envelope checks.
- [x] Implement strict frame parsing and monotonic `at` reduction.
- [ ] Test official A–D frames, corrupt JSON, HTML, empty responses, disconnects,
      delayed frames, forged windows, and old echoes.
- [ ] Implement phase/countdown UI using server-clock offset.

## P2 — registration and session

- [ ] Normalize and validate private GitHub repository roots, the one-time
      `invitation`, and all other registration fields.
- [ ] Build registration draft with explicit local-storage consent and warning
      that display name is public.
- [ ] Implement registration, including `authentication-busy` retry behavior.
- [ ] Implement lost-registration-response recovery via login-first state machine.
- [ ] Implement login/logout, expiry warning, redacted session vault, and screen
      restoration after `401`.
- [ ] Show organizer invitation and `.zoria` instructions immediately on success.
- [ ] Exercise the full flow against the training stand during its hourly window.

## P3 — repository and network content

- [ ] Implement summary polling and dependency-driven invalidation.
- [ ] Show repository status/reason/checked time and `verifiedElsewhere` warning.
- [ ] Implement session-only repository change.
- [ ] Implement stable, restartable pagination for news and inbox.
- [ ] Implement inbox detail and explicit mark-read action.
- [ ] Implement stages, detail, errata refresh, and explicit acknowledgment.
- [ ] Add safe Markdown allowlist and safe HTTP(S)-only links.
- [ ] Add public roll and optional fragment reconstruction.

## P4 — readiness

- [ ] Run the complete `docs/TEST_PLAN.md` matrix on the training stand.
- [ ] Complete responsive, keyboard, screen-reader, and reduced-motion passes.
- [ ] Run secret scanning and inspect built assets/source maps for credentials.
- [x] Add `.zoria` with the confirmed network username `roman-nalapko`.
- [x] Invite `zoria-net-bot` with the required Write permission (invitation sent
      2026-09-22; bot acceptance is asynchronous).
- [ ] Confirm `accessStatus: verified` well before the deadline.

## Later released stages

- [ ] On 2026-09-28, archive part 2 text/errata and add bot/SDK tasks without
      guessing unreleased contracts.
- [ ] On 2026-10-05, archive parts 3/4 and add HQ/preflight tasks and anchors.
- [ ] Keep `DECISIONS.md` current; finish it by final submission.
- [ ] Write `EPISODE.md` only from the assigned match episode and final code.
