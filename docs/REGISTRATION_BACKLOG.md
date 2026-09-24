# Registration reliability audit and urgent backlog

Recorded 2026-09-24, approximately 19:12 UTC (22:12 Europe/Bucharest).
This is an audit, not a claim that the defects below have been fixed.

## Verified snapshot

- Private repository: https://github.com/roman-nalapko/zoria ; default branch main.
- Local branch: codex/zoria-agent-foundation; last implementation commit 5b83e68.
- PRs 1–4 merged. PR 4 introduced persistent TELEGRAM_CHAT_ID and nonfatal
  Telegram health-notification failures.
- Last observed live run: https://github.com/roman-nalapko/zoria/actions/runs/36024289951
  started 2026-09-24 16:00:26 UTC and was in_progress at the audit. Recheck now.
- Earlier run 35972333007 failed at 10:26 UTC on Telegram delivery; it did not
  launch a successor. An active workflow does not imply an active job.
- One fresh ether request at 19:10:17 UTC returned HTTP 403 and invalid-envelope.
  No new phase was verified. Noise does not prove static, window, or after.
- Earlier login returned 401 invalid-credentials: supplied credentials did not
  authenticate. This alone is not proof that no account exists.
- .zoria on main contains roman-nalapko. Organizer bot invitation sent
  2026-09-22 08:11:55 UTC with Write access remains pending; valid seven days.
- npm run check passed 14 files / 33 tests. Worker tests cover configuration,
  not the full registration loop; green CI is insufficient readiness evidence.
- GitHub Actions secrets already exist: ZORIA_INVITATION, ZORIA_PASSWORD,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. GitHub cannot return their plaintext.
  Use them inside approved workflows; never copy real secrets into this repo.
- No Cloud Run service was deployed. User has no budget. Do not enable paid
  infrastructure, make the repository public, or promise unlimited free Actions.

## Official sources and admission

- https://zoria.net/spec/part1/tz/
- https://zoria.net/spec/client/
- https://zoria.net/spec/openapi/
- https://zoria.net/news/
- https://zoria.net/faq/
- https://zoria.net/reference/calendar/
- https://zoria.net/reference/addenda/

Window starts between September 24 05:00 UTC and September 25 09:00 UTC
(08:00 and 12:00 Europe/Bucharest respectively). Duration is at least ten hours;
actual end is signed window.closesAt. A signed harbinger appears six hours before
opening. Scripts/curl registration is allowed. Registration and repository
verification are separate: accessStatus must become verified before October 5
21:00 UTC (October 6 00:00 Bucharest). Bot acceptance follows registration.
The invitation code belongs in the API request, not .zoria.

Production key fingerprint remains:
dcb3155eb8f2538d466a294315e984fa9f67f703556c5e276d5b3afc88895696

September 24 addendum corrects harbinger.text to {uk, en} and re-signs training
frame A. Our type/fixture still use ru. This is not evidence the production key
changed. Read the live source before replacing fixtures.

## P0 — fix before relying on unattended registration

- [ ] R1: Make temporary API failures recoverable. once.ts reportFailure throws;
      shell bash -e exits, so 5xx, network errors, or exhausted authentication-busy
      retries kill the live job before dispatching its successor. Use classified
      outcomes, bounded jittered retries and durable progress. Permanent validation
      failures must notify accurately, never loop aggressively. Test 503, timeout,
      busy beyond three attempts, 429, Telegram failure and eventual success.
- [ ] R2: Validate sessions before announcing success or stopping. zoria.ts sets
      ok from HTTP alone and discards auth bodies. A local mock HTML response with
      status 200 made login() return ok:true. The official server promises normal
      login replies; this repro tests robustness, not observed server behavior.
      Validate token/session/expiry/user identity; confirm authenticated access.
      Test malformed JSON, HTML 200, empty fields, wrong identity and valid sessions.
- [ ] R3: Keep monotonic frame and origin quiet state across checks/restarts.
      Live workflow invokes a fresh once.js process every ten minutes, resetting
      latestFrameAt, key cache and quietUntil. Preserve nonsecret state safely;
      never retry before Retry-After, including process handover. Validate window
      timestamps and prevent old signed echoes from triggering registration.
- [ ] R4: Cover uncertain registration comprehensively. Current recovery only
      immediately handles status 0, not 5xx, malformed success or 409. Recover by
      login before another registration; retry registration only after definitive
      invalid-credentials and a still-valid verified window. One account only.
- [ ] R5: Prove unattended job continuation. Current self-dispatch occurs only
      at normal loop completion and has never been observed succeeding. Check all
      step failures, GitHub API timeouts, concurrency, dispatch permissions and token
      behavior. Avoid simultaneous registering workers. Test a short non-registering
      handover instead of waiting hours. Keep coverage during rollout.
- [ ] R6: Establish an actual zero-spend runtime budget. Sleeping hosted runners
      consume minutes: 24 hours is about 1440 minutes plus setup/CI. Billing usage API
      returned 404 with missing user scope, so remaining quota/spending settings are
      UNKNOWN. Do not expand OAuth scopes silently. Use user-visible billing or
      an existing authorized read path; choose bounded runtime and a stop condition.
      Source: https://docs.github.com/en/actions/concepts/billing-and-usage

## P1 — observability and admission completion

- [ ] R7: Telegram: include signed frame timestamp, check time, harbinger opening
      time/countdown and time zone. Distinguish static, after, unverified noise,
      transport failure and key mismatch. Current after text incorrectly says not
      yet open. Send routine messages every ten minutes as requested, major changes
      promptly. Do not let notification delivery block registration.
- [ ] R8: Require a fixed Telegram destination; remove automatic selection of the
      latest arbitrary private chat. Parse Telegram ok/result, support retry_after
      and bounded retries, retain successful-registration notification pending
      delivery even if window closes. Never log tokens or raw private responses.
- [ ] R9: After registration query /me/repository with the validated session and
      report accessStatus/reason/checkedAt. Registration success is not verified
      admission. Do not stop all admission tracking before verification is handled.
- [ ] R10: Update the September 24 harbinger language/official fixture change and
      deeply validate frame fields without rejecting unknown fields. Add official
      control-frame coverage, stale/reordered/future/malformed nested data tests.
- [ ] R11: Exercise the full worker on the training stand using training-only
      credentials, invitation STAND-2026 and the training key. Do not consume the
      production invitation in a test or create a second production account.
- [ ] R12: Audit repository history/artifacts for secrets with redacted output.
      Prior chat contained credentials and prior tool calls put them in command
      arguments; earlier claims that secrets were never in arguments were incorrect.
      Coordinate rotation without breaking the live watcher or losing invitation.

## P2 — finish part 1 client

- [ ] Session vault/login/logout/expiry restoration and authenticated UI.
- [ ] Repository status and admission instructions.
- [ ] Summary, news, inbox and released-stage polling; safe Markdown.
- [ ] Remaining route shell/accessibility/test-plan work in ROADMAP.md.

## Handoff acceptance

Record tested failure paths and deployment commit/run IDs. Do not claim end-to-end
success from In progress or a sent Telegram status. Require validated account
authentication and separately verified repository access. Document unresolved
quota, delivery and provider availability limits candidly. Preserve historical
logs; append corrections rather than silently rewriting earlier observations.
