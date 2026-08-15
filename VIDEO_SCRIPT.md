# Video script (~5 min) — outline for recording

Screen-record the live site (https://laynr.github.io/FedRAMP/); webcam optional. ≈5:15 total.

**0:00–0:35 — Cold open on Pulse**
- "Two days ago I had zero FedRAMP experience — I've built AI inside classified networks, but
  never walked in the front door. This is the tool I built to learn it — and it runs on
  FedRAMP's own published data."
- Point at the hero tile: "Median 70 days to certified on the new 20x path,
  versus 327 on the legacy path. I couldn't find that number published
  anywhere — this computes it from FedRAMP's event log, in your browser."

**0:35–1:10 — The story of v1 → v2 (honest judgment beat)**
- "First version was a beautifully cited 10-minute explainer. I reviewed it like a user and
  killed it: wall of text, no reason to return. Version two asks two questions of itself: why
  would anyone come back, and where's the actual engineering? The explainer survived as a
  dedicated Learn page for newcomers — each format doing its own job."

**1:10–2:00 — Why you come back: the watchlist**
- Star two services live. Reload with a seeded old fingerprint (or pre-arranged): show
  **"Since you were last here: Coralogix — PMO Review → FedRAMP Certified."**
- "No backend, no accounts — a versioned localStorage schema and a pure diff function with
  tests. Star your competitors and check back weekly."

**2:00–2:50 — Where the engineering is: journeys**
- Open a service profile: the dated journey timeline. "FedRAMP's changelog is messy real-world
  event data — migration backfill, duplicates, journeys with no recorded start. The journey
  engine documents its invariants, excludes what it can't trust and *counts* the exclusions —
  they're in the method note, not swept under the rug."
- Flip to "How long?": histogram, percentiles, fastest-journeys leaderboard
  (11 days!).

**2:50–3:30 — The toolchain, not just a webpage**
- "The site is one consumer of the toolchain: a zero-dep CLI that's also a Claude Code skill,
  a test suite including adversarial event-log fixtures, CI on every push plus a weekly data
  refresh, and the snapshots ship as a documented CORS-open JSON API anyone can build on."
- Click "Fetch live from the GSA-published feed" — same transforms, recomputed in-browser.
- Show the "What is FedRAMP?" drawer: "the 90-second explainer, every claim cited, each URL
  verified by a link auditor in CI because fedramp.gov's June restructure broke half the
  internet's links."

**3:30–4:30 — Security, and how the code got there (v1 → v2 → v3)**
- Frame the threat model plainly: "This page renders data it fetches from third parties. So the
  design assumption is that the feed — or the CDN in front of it — is hostile. The requirement
  I set: even a fully poisoned feed must not let this page serve malware or trackers."
- Name the layers while showing the about-page security note (or devtools → the CSP meta):
  1. "Sanitize at the boundary — every string type-checked, length-capped, control-chars
     stripped in one shared transforms module, so the CLI snapshots and the browser's live
     fetch get identical protection."
  2. "Escape at every render sink — feed strings never reach an HTML parser."
  3. "Content-Security-Policy on every page — the browser is *incapable* of contacting anything
     but the two GSA data CDNs. No trackers isn't a promise, it's policy."
  4. "Hostile-fixture tests in CI — script tags, `javascript:` URLs, prototype-pollution keys,
     oversized strings through every transform — and the weekly refresh scans snapshots before
     committing, so poisoned data can't even land in the repo."
- The version arc, honestly: "That security posture is v3 — it wasn't there on day one. v1 was
  the explainer. v2 was the tool. Before submitting, I turned three review agents loose on my
  own finished work, adversarially. They found XSS paths from the feed to the DOM, a chart that
  could freeze the tab on empty data, a live-refresh that left three of four views stale — and
  a percentile off-by-one that changed the headline median from 361 to 327 days. Every fix
  shipped with a regression test; the suite went from 15 tests to 39. I even verified it in the
  browser by injecting live XSS payloads into every field of a fake service — they all render
  as inert text."
- Land the point: "Catching your own headline number is the point: verification culture over
  confidence. The commit history shows all three versions — including the teardown."

**4:30–5:15 — Close**
- "Judgment calls I'd defend: vanilla and dependency-free for reviewability; static by scope —
  a production version gets a backend, notifications, a real API service; and honesty as a
  feature — small samples labeled, exclusions counted, 'unofficial' in the masthead."
- Time spent: "About 2.6 hours wall-clock — the commit timestamps are the receipt, v1 through
  the rebrand. Much of it was agents working while I was away; my time was judgment, not typing.
  I optimized for leverage because that's what the brief rewards." "It's the rare FedRAMP
  resource that gets more correct over time — and gives you a reason to come back."
