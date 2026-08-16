# Codex combined audit and repair session — 2026-08-15

This is a concise, human-readable summary of the Codex session that combined the independent
code audit with the owner's submission-cleanup findings. It is not a raw transcript or an
internal-reasoning trace.

## Request

The owner asked Codex to merge both reviews into one safe change set, keep the documentation
truthful, preserve the raw AI transcripts, test the result, attach this session summary to the
code change, then commit and push.

## Evidence policy

The review started from commit `dde3ac5`. Documentation and comments were treated as claims to
verify, not proof. The implementation, unit fixtures, official-feed snapshot, generated output,
and rendered local application were checked directly.

## Changes made

- Same-day journey events now use recorded timestamps before lifecycle order. This fixes the
  Wallarm Federal Cloud profile, whose later-recorded FRR event had been displayed behind a
  same-day `No Status Found` event. Recorded timestamps are strictly validated before they can
  affect ordering.
- True same-instant migration events use a complete status rank, so IntelliGRC displays Initial
  Program Review before Final Program Review. CSP and service names are selected independently
  from their latest non-empty recordings rather than whichever input row happened to arrive first.
- The statistic labeled “median” now uses the conventional midpoint of the middle pair for even
  cohorts. Nearest rank remains the documented method for p10 and p90.
- Official-feed snapshots were regenerated. The current medians are 316 days overall, 67 days
  for the explicit 20x cohort (n=26), and 327.5 days for legacy paths (n=508).
- The time story was reduced to one approximate figure: about six hours of active development,
  plus video recording. Transcript-derived timing remains supporting evidence, not a claimed
  complete clock.
- Process-heavy review narration was shortened; the unreferenced copied role description and closing
  self-grade were removed. The video script remains because recording is still pending.
- Security/provenance prose now matches the actual sequence: downloads are bounded, parsed,
  digested, and verified before derived state is accepted; it no longer claims digesting happens
  before parsing.

Raw `transcripts/*.jsonl` files were not modified.

## Generated-data impact

Five journey records changed: Wallarm and IntelliGRC received the targeted ordering corrections;
one same-day FRR → Agency Review sequence was also corrected; and two services now use their
latest recorded names. Cohort membership and measured durations did not change. The published
median values changed only because the median definition was corrected.

## Verification

- Unit, hostile-input, security-policy, and provenance suite: 57 passed; the one opt-in
  live-network shape test was skipped as designed.
- Full official changelog produced identical per-service journey records after indexing by ID
  when every input row was reversed.
- Snapshot generation completed twice with stable non-derived bundles.
- Link audit: 32/32 URLs returned HTTP 200.
- `npm audit`: zero known vulnerabilities.
- CLI help and fastest-journey smoke checks passed.
- In the local in-app browser: no render errors or console diagnostics; Pulse showed 67 vs
  327.5; duration tiles showed 316 / 67 / 327.5; Wallarm ended at FRR; IntelliGRC displayed
  Initial Program Review → Final Program Review → Authorized.
- The pinned Playwright Chromium binary installed, but this macOS sandbox denied Chromium's Mach
  IPC registration. The unchanged seven-test Playwright suite remains a required Ubuntu CI job
  on push.
- `git diff --check` passed.

## Commit association

This summary ships in the same commit as the code, snapshot, test, and documentation changes:
`Correct journey analytics and simplify submission`.
