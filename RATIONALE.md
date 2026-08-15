# Design rationale — OnRamp, an unofficial FedRAMP explorer

*Written doc accompanying the ~5 minute video. Take-home for Anthropic, Staff+ SWE (Public
Sector). Live at https://laynr.github.io/FedRAMP/*

## Why this theme, this idea

Theme 1 (Exploration & Understanding), pointed at a real gap in my own knowledge: I've built AI
systems *inside* classified environments but had never approached the government from the
outside — FedRAMP was a word I knew and a process I didn't. The role I'm applying for lists
"FedRAMP to classified networks" as daily terrain. So I built the tool I actually needed.

The timing gave the idea teeth: FedRAMP replaced its rulebook in June 2026 (Consolidated Rules,
FedRAMP 20x), the JAB is gone, sponsors are no longer required, and Rev5 has a public sunset
date — most content online is now quietly wrong. A tool wired to the program's own
machine-readable data stays right as the program moves.

## v1 → v2: killing the wall of text (the judgment story)

v1 was a beautifully cited 10-minute explainer. My own review: *it didn't spark joy — a wall of
text nobody visits twice.* So v2 inverted the product: **tool first, explainer demoted to a
90-second drawer.** Two questions drove the redesign, asked bluntly of my own work:

1. **"Why would anyone return?"** Answer built: the watchlist. Star services; localStorage
   keeps a fingerprint of each; your next visit *leads* with "since you were last here: Coralogix
   went PMO Review → FedRAMP Certified." A genuine return mechanic with zero backend.
2. **"Where does it demonstrate engineering depth?"** Answer built: the journey engine.
   FedRAMP's status changelog is messy real-world event data (migration backfill, out-of-order
   rows, duplicates, incomplete journeys). Reconstructing per-service journeys and
   time-to-authorization analytics from it — with documented invariants, counted exclusions,
   and adversarial test fixtures — is provenance-and-correctness engineering, the same muscle
   regulated-environment work uses. It surfaced a finding I couldn't find published anywhere:
   **median 70 days to certified on the 20x path vs 327
   legacy** (n stated, caveats in-app).

The v1 explainer wasn't discarded, though — reviewing v2 as a newcomer showed the tool now
assumed knowledge the explainer used to teach. It came back as a dedicated
[Learn page](https://laynr.github.io/FedRAMP/learn.html), updated and re-cited, so the tool and
the teaching each get the format they deserve.

### The hardening pass

Before submission I ran three parallel review agents — code quality, security, content accuracy
— against the finished product, and let the findings land where they fell. The most humbling:
a percentile implementation off by one rank, which **changed the headline median this project
exists to publish**. Also caught: XSS sinks reachable from the upstream feed (fixed with
sanitize-at-boundary + escape-at-sink + CSP), a stale-view bug after live refresh, and a CI
claim in this very document that wasn't yet true (it is now — see below). I'd rather ship the
corrected number with the story of catching it than the wrong number with confidence; that
verification culture is the actual deliverable.

## The non-obvious part

The medium is the message. 20x's thesis is machine-readable, continuously-validated security
instead of narrated documents. This tool practices that on itself: figures computed in-browser
from GSA's feeds (one click re-fetches live), KSI counts counted from the rules file rather than
asserted (the current file says 46 indicators — most 2025-era articles still say 61), countdowns
that age gracefully, and one set of pure transforms shared by CI and browser so the snapshot and
live views run the same code.

## Key decisions & tradeoffs

- **Vanilla, zero dependencies, no build step.** Reviewability over toolchain; the assignment
  rewards scoping. Charts are hand-rolled SVG following a validated color/accessibility method
  (colorblind-safe series separation, designed dark mode, reduced-motion respected).
- **Snapshot-first, live-upgrade.** Instant first paint, works offline, self-contained for
  reviewers — and one click proves it's real data.
- **Static site is a stated scope decision.** A production version needs a backend (scheduled
  ingestion, notifications for watchlist changes, an actual versioned API service), authn for
  saved state across devices, and monitoring. The static version was chosen deliberately: it
  demonstrates the data engineering and product thinking without an ops burden no reviewer can
  evaluate in ten minutes.
- **Honesty as a feature.** Every explainer claim cited to a URL the link auditor verifies
  (`tools/check-links.mjs`, run on a schedule by `.github/workflows/links.yml`; tests run on
  every push via `ci.yml`); exclusions counted and shown; the 20x/legacy comparison labeled
  directional; zero claims about any specific company's strategy; "unofficial" in the masthead.
- **Hostile-input posture.** The upstream feed is treated as untrusted: sanitized at the parse
  boundary, escaped at every sink, locked down with CSP, and exercised by hostile fixtures in
  CI — because a tool that mirrors government data should be incapable of serving anything else.

## With more time

Watchlist notifications (RSS/email via the CI job); journey diffing across rules versions
("which KSIs changed since you last looked"); an MCP server over the same data layer so agents
can query FedRAMP state; agency-level adoption trends over time.

## Time spent

**Wall-clock: ~2.6 hours** — the git history is the honest record: first commit 10:31, last
13:12 on 2026-08-15 (`git log --format='%ci'`), spanning a shipped v1, a v2 teardown-and-pivot,
a v3 hardening pass, and the OnRamp rebrand.

That number deserves an asterisk in both directions. It understates *elapsed* time: much of the
work ran as background AI agents (research, review, per-file implementation) while I was away
from the keyboard, so calendar time was longer than 2.6 hours. But it also overstates *my* hands-
on effort in the usual sense — my actual work was direction and judgment, not typing: choosing
the concept, killing v1 on taste, setting the accuracy and humility rules, running an adversarial
review pass on my own finished work, and deciding what to keep. I leaned into orchestration
precisely because the brief rewards leverage; the interesting measure isn't hours logged, it's
the judgment applied per hour. I'd rather show the real commit timestamps than pad a number.

## AI usage

Built end to end with Claude Code — research (three parallel verification agents against live
official sources), implementation, closed-loop testing where Claude drove the app in Chrome
itself (clicking every view, seeding localStorage to simulate a return visit, reading the
console, fixing what it found, and re-verifying post-deploy), and the pre-submission hardening
pass described above. Transcripts accompany the submission. My role was direction and judgment:
the concept, the accuracy rules (cited-or-cut, no company claims), the v1 teardown, and the two
hard questions above.
