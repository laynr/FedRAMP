# FedRAMP — unofficial explorer

**Live: https://laynr.github.io/FedRAMP/**

A live tool for exploring FedRAMP — the U.S. government's cloud security-approval program —
built on FedRAMP's own machine-readable data. The webpage is one consumer of a small toolchain
this repo ships: a zero-dependency data CLI (also packaged as a Claude Code skill), a set of
unit-tested pure transforms shared byte-for-byte between Node and the browser, a weekly CI data
refresh, and a documented CORS-open static JSON API. Built as a take-home for Anthropic by an
engineer who had never touched FedRAMP before this project.

## What it does

- **Pulse** — what's happening in the program right now: status changes and agency adoptions
  from GSA's published feeds, live countdowns to the program's real deadlines, and — if you've
  starred services — **"since you were last here"**: a diff of your watchlist against your last
  visit, computed client-side.
- **Services** — instant search over all ~670 listings; every service opens a profile with its
  **journey** (its actual dated path through the authorization process, reconstructed from
  FedRAMP's status-change log), who uses it, and its reuse footprint.
- **How long?** — the question every newcomer asks, answered from the event log instead of
  folklore: median **70 days** to certified on the 20x path vs **361** on legacy paths (as of
  Aug 2026; n and caveats stated in-app), with distribution and a fastest-journeys leaderboard.
- **Agencies** — who's adopting what across 244 agencies.
- **KSI Quest** — the 20x security catalog rendered from the official rules JSON, as a
  self-check study aid with gap-list export.
- **What is FedRAMP?** — the explainer, demoted to a 90-second drawer; every claim cited to a
  source verified live (see [Sources & method](https://laynr.github.io/FedRAMP/about.html)).

## The engineering underneath

```
docs/                 the app — vanilla HTML/CSS/ES modules, zero deps, no build step
  js/transforms.js    pure transforms incl. the journey engine (see invariants in-file)
  js/watchlist.js     versioned localStorage schema + pure fingerprint diff
  data/               pruned snapshots = a tiny public JSON API (see data/README.md)
tools/
  fedramp-data.mjs    zero-dep CLI: fetch/products/ksi/changelog/journeys/stats/snapshot
  fedramp-data.test.mjs  16 tests incl. deliberately nasty event-log fixtures + live checks
  check-links.mjs     verifies every cited URL returns 200
.github/workflows/refresh-data.yml  weekly: test → re-snapshot → commit
.claude/skills/fedramp-data/        the CLI documented as a Claude Code skill
```

The **journey engine** (`docs/js/transforms.js`) is the technical core: FedRAMP's changelog is
real-world event data — migration-era backfill, out-of-order rows, duplicates, journeys with no
recorded start or finish. The engine documents its invariants, excludes what it can't trust
*and counts the exclusions* (surfaced in the app's method note), and is tested against fixtures
for each failure mode. The same code computes the numbers in CI snapshots and in your browser's
"fetch live" — they cannot disagree.

## Run it

```bash
python3 -m http.server 4173 --directory docs   # → http://localhost:4173/
node --test tools/*.test.mjs                   # tests (RUN_LIVE=1 adds live shape checks)
node tools/fedramp-data.mjs journeys --fastest # the CLI, dogfooded throughout
node tools/check-links.mjs                     # citation link audit
```

## Honesty notes

Unofficial; not affiliated with GSA or the FedRAMP program. Duration analytics carry a visible
method note (the 20x sample is small and early). No claims about any company's compliance
strategy. No cost figures — none exist officially. Corrections:
[open an issue](https://github.com/laynr/FedRAMP/issues). Design write-up: [RATIONALE.md](RATIONALE.md).
