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

## P0 — fix before relying on unattended registration (RESOLVED & VERIFIED 2026-09-25)

- [x] R1: Make temporary API failures recoverable. once.ts no longer throws;
      uses classified outcomes, bounded jittered retries for 5xx/transport,
      and shell `|| true` prevents step termination. Verified in test and live run.
- [x] R2: Validate sessions before announcing success or stopping. zoria.ts validates
      token presence and username identity match. HTML 200 or malformed JSON rejected.
      Verified in zoria.test.ts.
- [x] R3: Keep monotonic frame and origin quiet state across checks/restarts.
      `dist-worker/worker-state.json` persists non-secret state between once.js invocations.
      Verified in state-file.test.ts.
- [x] R4: Cover uncertain registration comprehensively. Recovery flow checks login
      before deciding whether to re-register; handles 409, 5xx, and malformed 200.
      Verified in test suite.
- [x] R5: Prove unattended job continuation. Successor dispatched on iteration 33
      (before sleeping); concurrency group prevents race conditions.
      Verified in live Actions run handover (36024289951 -> 36051771424 -> 36082418867).
- [x] R6: Establish an actual zero-spend runtime budget. Documented 2000 min limit,
      added ZORIA_MAX_CHECKS env override, automated self-disable on registration.

## P1 — observability and admission completion (RESOLVED & VERIFIED 2026-09-25)

- [x] R7: Telegram: include signed frame timestamp, check time, harbinger opening
      time/countdown and time zone (Europe/Bucharest). Distinguish phases correctly.
      Fixed 'after' text. Verified in live Telegram delivery.
- [x] R8: Require a fixed Telegram destination; remove automatic selection.
      Parse Telegram ok/result, support retry_after and bounded retries,
      retain pending success notification. Verified in telegram.test.ts.
- [x] R9: After registration query /me/repository with the validated session and
      report accessStatus/reason/checkedAt. Confirmed: `accessStatus: "verified"`,
      `reasonCode: "marker-found"` in run 36101283072.
- [x] R10: Update the September 24 harbinger language to {uk, en} with backward
      compatibility for training {uk, ru}. Robustness tests added for malformed,
      reordered, and unknown fields. Verified in verifier.test.ts.
- [x] R11: Exercise worker on training stand with synthetic config.
      Verified in test suite without touching production invitation.
- [x] R12: Audit repository history/artifacts for secrets with redacted output.
      Confirmed clean of plaintext credentials.

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
