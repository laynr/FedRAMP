# OnRamp — an unofficial FedRAMP explorer

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
- **Services** — instant search over all ~670 listings; every service opens a
  profile with its **journey** (its actual dated path through the authorization process,
  reconstructed from FedRAMP's status-change log), who uses it, and its reuse footprint.
- **How long?** — the question every newcomer asks, answered from the event log instead of
  folklore: median **67 days** to certified on the explicit 20x cohort vs
  **327.5** on legacy paths (as of Aug 2026; n and caveats stated in-app), with
  distribution and a fastest-journeys leaderboard.
- **Agencies** — who's adopting what across federal agencies.
- **KSI Quest** — the 20x security catalog rendered from the official rules JSON, as a
  self-check study aid with gap-list export.
- **Learn** — the full explainer for newcomers: who's who, how the paths differ, checkpoints
  to test yourself. A 90-second version lives in the in-app "What is FedRAMP?" drawer; every
  claim cited to a source verified by the link auditor (see
  [Sources & method](https://laynr.github.io/FedRAMP/about.html)).

## The engineering underneath

```
docs/                      the app — vanilla HTML/CSS/ES modules, zero runtime deps, no build step
  index.html               the tool; learn.html — the explainer; about.html — sources & method
  js/transforms.js         pure transforms incl. the journey engine (see invariants in-file)
  js/data.js               state + all-feed live refresh (bounded fetch, validation, atomic swap)
  js/feeds.js              feed identities + immutable Git revision resolution, shared browser/CLI
  js/fetch-json.js         streamed cap, Git-blob match, UTF-8/JSON validation, SHA-256
  js/views/                pulse.js, services.js, duration.js, agencies.js — one module per view
  js/ui.js, js/charts.js   shared primitives: escaping, safe storage, hand-rolled SVG charts
  js/watchlist.js          versioned localStorage schema + pure fingerprint diff
  js/sources.js            the citation registry every in-app claim points into
  data/                    pruned snapshots = a tiny public JSON API (see data/README.md)
tools/
  fedramp-data.mjs         zero-dep CLI: fetch/products/ksi/changelog/journeys/stats/snapshot
  transforms.test.mjs      the test suite, incl. deliberately nasty event-log fixtures
  hostile.test.mjs         hostile-input fixtures: XSS payloads, prototype pollution, bad dates
  fetch.test.mjs           bounded-download, digest, and immutable-revision trust-boundary tests
  security-policy.test.mjs CSP strictness, no-inline-style, and snapshot-provenance assertions
  check-links.mjs          audits every cited URL across all pages and the source registry
.github/workflows/
  ci.yml                   unit + Playwright E2E/a11y/responsive/render tests on every push/PR
  refresh-data.yml         weekly: test → re-snapshot → commit; pages.yml — Pages deploy
.claude/skills/fedramp-data/   the CLI documented as a Claude Code skill
```

The **journey engine** (`docs/js/transforms.js`) is the technical core: FedRAMP's changelog is
real-world event data — migration-era backfill, out-of-order rows, duplicates, journeys with no
recorded start or finish. The engine documents its invariants, excludes what it can't trust
*and counts the exclusions* (surfaced in the app's method note), and is tested against fixtures
for each failure mode. The same transforms module computes the numbers in CI snapshots and in
your browser's "fetch live", so the two paths share one implementation: products, journeys,
activity, agencies, and the KSI rules catalog all recompute live in one atomic state swap.

## Security

The upstream feeds are treated as hostile input. Mutable branch names are resolved through the
GitHub API, then data is fetched only by immutable commit; the exact revision, URL, byte count,
Git blob match, and SHA-256 digest are exposed in the UI and recorded with snapshots. Downloads
are byte-capped while streaming and verified against the pinned Git blob before derived state is
accepted. Every string is sanitized at the transforms boundary (type-checked, length-capped,
control characters stripped, fields allowlisted) —
the bundled snapshots at generation time, the live path in-browser, with both load paths
shape-validated before the atomic state swap. Strings are escaped again at every render sink
(URL sinks get a scheme allowlist instead), and the pages carry a Content-Security-Policy that
allowlists only GitHub's provenance endpoints and two immutable data mirrors — so even a missed
escape couldn't execute script or phone home elsewhere. A hostile-fixture test suite (script
tags, `javascript:` URLs, `__proto__` keys, oversized strings, malformed dates) runs in CI,
alongside browser workflows, automated WCAG
checks, responsive overflow checks, and rendered-layout assertions. The weekly refresh scans
snapshots before committing them. No analytics, no trackers, no third-party scripts.

## Run it

```bash
python3 -m http.server 4173 --directory docs   # → http://localhost:4173/
node --test tools/*.test.mjs                   # tests (RUN_LIVE=1 adds live shape checks)
npm ci && npx playwright install chromium      # one-time browser-test setup
npm run test:e2e                               # E2E + WCAG + responsive/render checks
node tools/fedramp-data.mjs journeys --fastest # the CLI, dogfooded throughout
node tools/check-links.mjs                     # citation link audit (also runs on a schedule in CI)
```

## Reusable: the `fedramp-data` Claude Code skill

`tools/fedramp-data.mjs` is documented as a **standalone Claude Code skill** in
[`.claude/skills/fedramp-data/`](.claude/skills/fedramp-data/SKILL.md) — useful on its own, not just
to this site. Drop the `.claude/skills/fedramp-data/` folder (plus `tools/fedramp-data.mjs`,
`docs/js/transforms.js`, `docs/js/feeds.js`) into any repo and Claude Code can answer FedRAMP
marketplace/KSI/journey questions from the live official feeds instead of guessing:

```
node tools/fedramp-data.mjs products --impact "20x Moderate"   # who's authorized under 20x
node tools/fedramp-data.mjs journeys --fastest                  # fastest authorizations on record
node tools/fedramp-data.mjs ksi CNA                             # a KSI family's indicators + NIST controls
```

Zero runtime dependencies, safe by construction (sanitizes hostile input, aborts snapshots that contain
suspicious content). See the skill file for the full command list.

## Honesty notes

Unofficial; not affiliated with or endorsed by GSA or the FedRAMP program. FedRAMP® is a
registered trademark of GSA; source data is a U.S. Government work in the public domain
(17 U.S.C. § 105) and derived stats here are unofficial. Duration analytics carry a visible
method note (small 20x sample; right-censored; explicit 20x markers only within the measured interval). No claims
about any company's compliance strategy. No cost figures — none exist officially. Corrections:
[open an issue](https://github.com/laynr/FedRAMP/issues). Design write-up: [RATIONALE.md](RATIONALE.md).
