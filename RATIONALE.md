# Design rationale — FedRAMP in 10 minutes

*Written doc accompanying the ~5 minute video. Take-home for Anthropic, Staff+ SWE (Public
Sector). Live at https://laynr.github.io/FedRAMP/*

## Why this theme, why this idea

I chose **Theme 1 (Exploration & Understanding)** and pointed it at a real gap in my own
knowledge. I've spent years building AI systems *inside* classified environments — but I've
never brought a product to the government from the outside, so FedRAMP was a word I knew and
a process I didn't. The Public Sector role I'm applying for lists "FedRAMP to classified
networks" as its daily terrain, so I built the artifact I actually needed: the shortest
honest explanation of FedRAMP as it works **today**, verified end to end.

The timing turned the idea from "another compliance explainer" into something with a real
edge: FedRAMP replaced its rulebook on June 24–25, 2026 (Consolidated Rules for 2026), the
JAB no longer exists, agency sponsors are no longer required, and the legacy Rev5 path has a
published sunset date. Most of what Google returns is now wrong. A static explainer would
join that graveyard within months.

## The non-obvious part

**The medium demonstrates the message.** FedRAMP 20x's core thesis is that security claims
should be machine-readable and continuously validated instead of narrated in Word documents.
So this explainer refuses to hand-type its facts:

- Marketplace figures are computed in your browser from the same GSA-published feed that
  powers marketplace.fedramp.gov, with a one-click "fetch live from source."
- The KSI catalog renders the official rules JSON — when the page says "46 indicators," it
  *counted them at load time*. (Good thing, too: most 2025-era articles say 61. The current
  rules version says otherwise, and my page will follow the file, not the folklore.)
- Date-based claims are countdowns computed client-side, so "Class B/C pipelines open in 16
  days" gracefully becomes "opened 30 days ago" without a redeploy.
- The pruned data snapshots are themselves republished as a small documented CORS-open JSON
  API from GitHub Pages, refreshed weekly by CI — a static site that ships a usable data
  service.

A page teaching "measured outcomes over documented plans" that itself practices measured
outcomes over documented plans felt like the right kind of non-obvious.

## Key decisions & tradeoffs

- **Vanilla, no build, zero dependencies.** The assignment values scoping and reviewability;
  a Vite/React stack would have added a toolchain to audit without adding explanatory power.
  Hand-rolled SVG charts follow a color/accessibility method (validated palette, colorblind-
  safe series separation, dark mode as designed steps rather than an automatic flip).
- **Shared pure transforms.** `docs/js/transforms.js` is imported by the browser, the CLI,
  and the tests — the live refresh and the CI snapshots can't disagree by construction.
- **Snapshot-first, live-upgrade.** The page paints instantly from bundled data (and works
  offline / if the feeds move); one click re-fetches the 4.4 MB source feed and recomputes
  everything in-browser. Reviewers get a self-contained demo *and* proof it's real.
- **Humility as a content rule.** No official cost figures exist, so costs are labeled vendor
  estimates. Unverifiable things are flagged, not asserted. The page makes zero claims about
  any specific company's compliance strategy — the practitioners are the experts; this page
  is a study aid and says so. Every one of the 21 cited URLs is verified live by
  `tools/check-links.mjs` (fedramp.gov's June 2026 restructure broke a remarkable number of
  the internet's FedRAMP links — nothing here is cited from memory or model training data).
- **Closed-loop testing.** Claude drove the page in Chrome itself — clicking every quiz,
  checkbox, filter, and the live-fetch button, reading the console, and fixing what it found
  — locally and again post-deploy.

## What I'd do with more time

- **Ship the data service properly**: a versioned FedRAMP-documents API (or MCP server) over
  the marketplace feed, rules, KSIs, and OSCAL baselines — the CLI/skill here is the seed.
- **"Which KSIs changed since you last looked"** diffing across rules versions, using the
  status changelog and git history of the official repos.
- **A guided Rev5→20x migration view** for the ~500 already-authorized services.
- Deep-dive pages per KSI family with the mapped NIST controls expanded inline.

## Time spent

Approximately **X hours** (Layne: fill in — wall-clock from repo creation to submission),
with Claude Code doing the research (three parallel verification agents), implementation, and
browser-based testing under direction.

## AI usage

Built with Claude Code end to end; transcripts accompany the submission. My role was
direction and judgment: choosing the concept and scope, setting the accuracy/humility rules
(cited-or-cut, no claims about specific companies), redirecting the design when research
surfaced landmines, and deciding what *not* to build.
