# Video script (~5 min) — outline for recording

Screen-record the live site (https://laynr.github.io/FedRAMP/); webcam optional. ≈5:00 total.

**0:00–0:35 — Cold open on Pulse**
- "Two days ago I had zero FedRAMP experience — I've built AI inside classified networks, but
  never walked in the front door. This is the tool I built to learn it — and it runs on
  FedRAMP's own published data."
- Point at the hero tile: "Median 70 days to certified on the new 20x path,
  versus 327 on the legacy path. I couldn't find that number published
  anywhere — this computes it from FedRAMP's event log, in your browser."

**0:35–1:20 — The story of v1 (honest judgment beat)**
- "First version was a beautifully cited 10-minute explainer. I reviewed it like a user and
  killed it: wall of text, no reason to return. Version two asks two questions of itself: why
  would anyone come back, and where's the actual engineering? The explainer survived as a
  dedicated Learn page for newcomers — each format doing its own job."

**1:20–2:20 — Why you come back: the watchlist**
- Star two services live. Reload with a seeded old fingerprint (or pre-arranged): show
  **"Since you were last here: Coralogix — PMO Review → FedRAMP Certified."**
- "No backend, no accounts — a versioned localStorage schema and a pure diff function with
  tests. Star your competitors and check back weekly."

**2:20–3:20 — Where the engineering is: journeys**
- Open a service profile: the dated journey timeline. "FedRAMP's changelog is messy real-world
  event data — migration backfill, duplicates, journeys with no recorded start. The journey
  engine documents its invariants, excludes what it can't trust and *counts* the exclusions —
  they're in the method note, not swept under the rug."
- Flip to "How long?": histogram, percentiles, fastest-journeys leaderboard
  (11 days!).

**3:20–4:10 — The toolchain, not just a webpage**
- "The site is one consumer of the toolchain: a zero-dep CLI that's also a Claude Code skill,
  a test suite including adversarial event-log fixtures and hostile-input payloads, CI on every
  push plus a weekly data refresh, and the snapshots ship as a documented CORS-open JSON API
  anyone can build on."
- Click "Fetch live from the GSA-published feed" — same transforms, recomputed in-browser.
- Show the "What is FedRAMP?" drawer: "the 90-second explainer, every claim cited, each URL
  verified by a link auditor in CI because fedramp.gov's June restructure broke half the
  internet's links."

**4:10–5:00 — Close**
- "Judgment calls I'd defend: vanilla and dependency-free for reviewability; static by scope —
  a production version gets a backend, notifications, a real API service; and honesty as a
  feature — small samples labeled, exclusions counted, 'unofficial' in the masthead."
- (~15s) "One last thing: before submitting I turned three review agents loose on my own
  finished work. They found a percentile bug that changed the headline median, and XSS paths
  from the upstream feed — both fixed before any reviewer saw them. Catching your own headline
  number is the point: verification culture over confidence."
- Time spent: <!-- LAYNE: state hours here when recording --> ~__ hours, including tearing down
  a shipped v1 for taste. "It's the rare FedRAMP resource that gets more correct over time —
  and gives you a reason to come back."
