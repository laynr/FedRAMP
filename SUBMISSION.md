# Submission — OnRamp (an unofficial FedRAMP explorer)

Everything the assignment asks for, in one place.

## Links
- **Live prototype:** https://laynr.github.io/FedRAMP/
- **Code (GitHub):** https://github.com/laynr/FedRAMP

## Deliverables checklist
| Item | Status | Where |
|---|---|---|
| Functioning deployed prototype | ✅ Live | https://laynr.github.io/FedRAMP/ |
| GitHub repo with the code | ✅ | this repo |
| Written design rationale | ✅ | [`RATIONALE.md`](RATIONALE.md) |
| ~5-min video | ⏳ **record from** | [`VIDEO_SCRIPT.md`](VIDEO_SCRIPT.md) (timed, ready) |
| AI transcripts | ✅ | [`transcripts/`](transcripts/) |

## What it is
A tool-first web app for exploring FedRAMP — the U.S. government's cloud security-approval
program — built entirely on the program's own machine-readable data. Theme 1 (Exploration &
Understanding). Self-contained: loads instantly from bundled snapshots, no reviewer input, no
keys; an optional "fetch live" button recomputes from GSA's feeds in-browser. A restored
[Learn page](https://laynr.github.io/FedRAMP/learn.html) carries the cited 10-minute explainer;
[Sources & method](https://laynr.github.io/FedRAMP/about.html) documents every citation.

## The one-paragraph pitch
FedRAMP replaced its rulebook in mid-2026, so most content online is now stale. OnRamp is wired
to the program's own live data, computes an answer nobody publishes (median ~64 days to certified
in the explicit 20x cohort vs ~327 on legacy — with the sampling biases named), lets you watch
services
and see "what changed since you were last here," and reconstructs each service's real
authorization journey from the event log. It treats the upstream feed as hostile input
(sanitize-at-boundary + escape-at-sink + CSP + hostile-fixture tests), ships accessible to
screen readers, and its data layer is a reusable Claude Code skill. See [`README.md`](README.md)
for architecture and [`AGENTS.md`](AGENTS.md) for how it was built.

## Time
Computed from the shipped transcripts, not asserted — reproduce with `node tools/time-report.mjs`
(classifies every transcript timestamp gap into agent processing / typed human input / dead time,
5-minute idle threshold; dead time away from the keyboard is subtracted):

- **Measured active time, all captured sessions: ~3.4 h** — 3.2 h agent processing +
  ~11 min typed human input across 26 prompts; 1.2 h of dead time subtracted. That covers the
  morning build (09:45–13:23), an afternoon check-in, two brief evening sessions, and the
  post-submission integrity pass (grade-then-fix, through ~21:34).
- **Not measured:** the evening Codex hardening session — no raw log retained, so no number is
  claimed; it's bounded only by its commits (20:50–21:02) and summarized in
  `transcripts/codex-hardening-session.md`. The measured 3.4 h is therefore a floor, not the total.
- **Calendar span:** first commit 10:31 to final push, 2026-08-15 — one day, with hours away
  between blocks.

An earlier version of this file claimed "~2.6 hours (10:31–13:12)"; that went stale the moment
the evening commits landed. See RATIONALE "Time spent" for the correction and method.

## Notes for the reviewer
- Unofficial; not affiliated with or endorsed by GSA. FedRAMP® is a registered trademark of GSA;
  source data is a U.S. Government work in the public domain (17 U.S.C. § 105).
- Corrections welcome: https://github.com/laynr/FedRAMP/issues
