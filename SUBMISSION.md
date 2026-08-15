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
to the program's own live data, computes an answer nobody publishes (median ~70 days to certified
on the new 20x path vs ~327 on legacy — with the sampling biases named), lets you watch services
and see "what changed since you were last here," and reconstructs each service's real
authorization journey from the event log. It treats the upstream feed as hostile input
(sanitize-at-boundary + escape-at-sink + CSP + hostile-fixture tests), ships accessible to
screen readers, and its data layer is a reusable Claude Code skill. See [`README.md`](README.md)
for architecture and [`AGENTS.md`](AGENTS.md) for how it was built.

## Time
~2.6 hours wall-clock (git timestamps 10:31–13:12, 2026-08-15). See RATIONALE "Time spent" for
the honest asterisks (much ran as background agents; the work was judgment, not typing).

## Notes for the reviewer
- Unofficial; not affiliated with or endorsed by GSA. FedRAMP® is a registered trademark of GSA;
  source data is a U.S. Government work in the public domain (17 U.S.C. § 105).
- Corrections welcome: https://github.com/laynr/FedRAMP/issues
