# Codex hardening session — 2026-08-15/16

This is a concise, human-readable log of the Codex review and implementation session that
followed the original Claude Code build. It records the user-visible requests, engineering
decisions, changes, and verification results. It is not a raw internal-reasoning trace.

## Request

The owner asked for a skeptical, code-first review of the repository as an Anthropic Staff+
take-home submission, explicitly warning against accepting documentation or comments as proof.
The follow-up asked to improve code quality, security, elegance, and completeness, with emphasis
on four identified risks:

1. Live refresh updated marketplace and changelog data but left KSI state on its old snapshot.
2. Live feeds trusted mutable branch URLs without immutable identity, integrity verification, or
   visible provenance.
3. Tests were concentrated in transforms and lacked browser, accessibility, responsive, and
   rendered-output coverage.
4. The broad scope and limited direct AI-workflow demonstration could be challenged by a Staff+
   review panel.

The owner asked to leave the video alone during this pass.

## Code changes

### Correct analytics cohorting

- Removed the heuristic that classified a record as 20x merely because its `Program` field was
  populated.
- A journey now enters the 20x cohort only through an explicit `cert_type` or `cert_path` value.
- Cohort attribution considers only events inside the selected journey interval, preventing a
  later reauthorization from relabeling an earlier legacy journey.
- Added regressions and regenerated the committed snapshots. The explicit 20x median changed
  from the previously reported 70 days to 64 days (n=26); the legacy median remains 327 days
  (n=508).

### Make live refresh complete and atomic

- Live refresh resolves and downloads marketplace, changelog, and KSI rules data together.
- All derived products, statistics, journeys, agencies, activity, and KSI state are computed and
  validated before a single state swap.
- Any failure leaves the previous consistent snapshot intact.
- KSI event listeners and async work are disposed before the refreshed view is initialized;
  saved checkbox IDs are filtered to the current catalog.

### Establish an immutable feed trust boundary

- Stable repository/file identities replace mutable runtime download URLs.
- GitHub branch heads resolve to exact 40-character commits; file identities resolve to exact Git
  blob IDs at those commits.
- Downloads use immutable commit URLs and are accepted only when their recomputed Git blob SHA-1
  matches the repository object identity.
- The shared fetch layer also enforces timeouts, pre-parse byte limits, expected content types,
  strict UTF-8, JSON validity, and SHA-256 evidence.
- Browser refresh, CLI ingestion, link checks, cache validation, and snapshot metadata use the
  same identity model. Cache bodies must match both their SHA-256 and Git blob metadata.
- The UI exposes commit, blob, SHA-256, byte count, and immutable source provenance.

### Tighten browser security and presentation

- Removed `unsafe-inline` and `unsafe-eval` from page CSPs.
- Replaced runtime inline style mutations with native attributes, `<progress>`, `hidden`, and
  static CSS.
- Fixed a mobile intrinsic-width overflow caused by visually hidden chart tables.
- Fixed two measured color-contrast failures in the selected tab and KSI version label.

### Add end-to-end quality gates

- Added Playwright and axe-core as pinned development dependencies.
- Added seven browser tests covering primary navigation, search, deep links, the explainer,
  mobile overflow in every main view, rendered chart geometry, light/dark accessibility on all
  pages and the dialog, and a mocked atomic live refresh including KSI and provenance.
- Added an Ubuntu CI browser job that installs Chromium and runs the suite.
- Added unit coverage for feed resolution, commit deduplication, byte limits, digests, invalid
  content types, invalid object IDs, blob mismatches, strict CSP, inline-style absence, snapshot
  provenance, and the corrected journey cohorting.

## Verification performed

- Node test runner: 49 required tests passed; one explicitly opt-in live-network shape test was
  skipped.
- `npm audit`: zero known vulnerabilities.
- Link audit: 32/32 checked URLs returned HTTP 200, including commit-pinned feed URLs.
- CLI help and fastest-journey smoke tests passed.
- Browser live refresh completed against the real feeds and updated KSI state.
- Browser viewport checks found no horizontal overflow in any main view at 375 CSS pixels.
- axe-core reported zero violations across the five app views, the explainer dialog, Learn, and
  About in light and dark themes after the contrast fixes.
- The dashboard was visually inspected after refresh.
- `git diff --check` passed.

The seven-test Playwright suite was parsed and listed locally, but local Chromium startup was
blocked by the host macOS sandbox denying browser Mach IPC registration. Equivalent browser
flows above were exercised through the already-running in-app browser. The committed CI job runs
the Playwright suite on Ubuntu, where that host-specific restriction does not apply.

## Deliberate non-changes and remaining limits

- `VIDEO_SCRIPT.md` was left unchanged at the owner's request. It still contains the obsolete
  70-day figure and must be corrected before recording.
- No cosmetic AI feature was added solely to mirror the job description. A credible government
  operator workflow or agent interface should be a deliberate product decision, not a label on
  an unrelated feature.
- The application remains a static prototype. It relies on GitHub availability, TLS, and API
  rate limits and does not claim to be a signed compliance-attestation service.
- Scope remains a presentation risk for a 1–2 hour exercise even though the shared data and view
  architecture keeps the implementation cohesive.

## Session assessment

After the hardening pass, the code-focused assessment was A− / 9.0 out of 10. The principal
remaining risks are submission positioning and role alignment rather than known correctness,
integrity, accessibility, or browser-completeness defects.
