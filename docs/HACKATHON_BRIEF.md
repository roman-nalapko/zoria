# Zoria 2026: implementation brief

Last reviewed: 2026-09-21. Canonical sources are the links in `README.md`; the
official OpenAPI contract wins when a field or status code differs from prose.

## What we are building now

A React + TypeScript client for Zoria Battle.net. It begins as the participant's
network console and grows into the scored game headquarters in part 3. Part 1
does not include the game, SDK, bot, WebSocket, SSE, or push notifications.

Required by 2026-09-28:

- registration during the window and login/session recovery;
- repository invitation instructions and verification status;
- polling summary, news, inbox, and released task stages;
- safe reading of stage text and errata;
- resilient response handling, backoff, rate-limit discipline, local time, and
  configurable training/production API origins.

Strongly recommended before the window:

- listen to `/ether` and verify signed frames;
- display the six-hour harbinger countdown;
- optionally store a registration draft locally and submit it after the first
  verified `phase: "window"` frame;
- show the public roll and reconstruct letter fragments.

## Admission checklist

- [ ] Receive the one-time application code (`invitation`) by email or Telegram.
- [ ] Register with `POST /auth/register` while the window is open, including the
      one-time code.
- [ ] Use the participant's own private GitHub repository; it no longer needs to
      be pre-listed in the application.
- [ ] Invite the configured organizer account (`zoria-net-bot` at publication).
- [ ] Put the final network username in `.zoria` on the default branch.
- [ ] Reach `accessStatus: "verified"` by 2026-10-06 00:00 local site time
      (2026-10-05 21:00 UTC for Europe/Bucharest while UTC+3).
- [ ] Keep repository access and `.zoria` unchanged through the competition.
- [ ] Keep a lockfile, documented commands, and no secrets in Git history.

Missing the registration window or repository verification deadline eliminates
the participant. Part 1 itself awards no points.

## Key dates

Site dates are displayed for Europe/Bucharest; API and canonical text use UTC.

| Date/time shown on site              | Event                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| 2026-09-21                           | Part 1 published; live ether starts                                            |
| 2026-09-24 08:00 to 2026-09-25 12:00 | Registration window starts at an undisclosed point and lasts at least 10 hours |
| 2026-09-26 12:00                     | Verifiable draw                                                                |
| 2026-09-28                           | Part 2: game, SDK, protocol, bot template                                      |
| 2026-10-05                           | Parts 3/4: headquarters and build/preflight requirements                       |
| 2026-10-06 00:00                     | Repository verification deadline                                               |
| 2026-10-07                           | Training day                                                                   |
| 2026-10-10 00:00                     | Group-stage code freeze                                                        |
| 2026-10-12 00:00–2026-10-14 08:00    | Group stage                                                                    |
| 2026-10-15–17                        | Second-stage evenings                                                          |
| 2026-10-17 06:00                     | Final submission and `DECISIONS.md`                                            |
| 2026-10-18 22:00                     | `EPISODE.md` deadline is 24 hours after assignment                             |
| 2026-10-21 21:00                     | Final results                                                                  |

Dates may move only forward under the published shift rule. Check news and the
addenda registry before every freeze.

## Protocol invariants

- Production API: `https://zoria.net/api/v1`.
- Training API: `https://stand.zoria.net/api/v1`.
- Before the window, most routes can return arbitrary noise, malformed bodies,
  misleading API-like errors, delays, disconnects, old signed echoes, or forged
  envelopes. Only a valid Ed25519 seal establishes a signal.
- Verify the signature over the exact received `frame` string, then parse it.
- Never roll state back from a frame whose `at` is older than the newest accepted
  frame.
- The published production-key fingerprint was not yet visible in the reviewed
  task text. Do not trust a production key until the canonical fingerprint is
  published and configured.
- `429` is never noise. Honor `Retry-After`; `jammed` silences all traffic to the
  origin. Use full-jitter exponential backoff for transport errors and unsealed
  5xx responses.
- A lost registration response must be resolved by attempting login first. Only
  retry registration after `401 invalid-credentials`.
- Registration requires `invitation`; an unknown, used, or expired code returns
  `422 invalid-invitation`.
- Poll summary cheaply and refresh dependent resources only when its counters or
  timestamps move.
- Paginated news/inbox reads restart at offset zero if data changes mid-read.
- Unknown fields are ignored; unknown notice types render as ordinary messages.

## Training stand

Every UTC hour: noise `:00–:30`, harbinger from `:20`, window `:30–:50`, and
after-window `:50–:00`. Use repositories `zoria-stand/station-01` through
`station-20`. Accounts reset daily at 03:05 UTC. The stand does not verify GitHub
access, so repository status remains pending.

## Scoring implications for architecture

Only group winners (plus any necessary wildcards) receive a score out of 100:
Tournament 45, Code 25, Headquarters 20, Analysis 10.

The foundation should therefore optimize for:

- reliability across every match and process restart;
- deterministic state and replayable decisions;
- strict async/resource ownership and zero swallowed errors;
- fast headquarters replay, channel profiling, preset comparison, and live view;
- strong tests capable of catching mutations;
- traceability from decisions to code for `DECISIONS.md` and `EPISODE.md`.

AI tools are explicitly allowed, but the participant must understand and defend
the submitted solution during a possible technical audit.
