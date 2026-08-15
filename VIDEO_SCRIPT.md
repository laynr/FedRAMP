# Video script (~5 min) — outline for recording

Screen-record the live site (https://laynr.github.io/FedRAMP/); webcam optional. ≈5:00 total.

**0:00–0:35 — Cold open on Pulse**
- "Two days ago I had zero FedRAMP experience — I've built AI inside classified networks, but
  never walked in the front door. This is the tool I built to learn it — and it runs on
  FedRAMP's own published data."
- Point at the hero tile: "Median 70 days to certified on the new 20x path, versus 361 on the
  legacy path. Nobody publishes that number — this computes it from FedRAMP's event log, in
  your browser."

**0:35–1:20 — The story of v1 (honest judgment beat)**
- "First version was a beautifully cited 10-minute explainer. I reviewed it like a user and
  killed it: wall of text, no reason to return. Version two asks two questions of itself: why
  would anyone come back, and where's the actual engineering?"

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
- Flip to "How long?": histogram, percentiles, fastest-journeys leaderboard (11 days!).

**3:20–4:10 — The toolchain, not just a webpage**
- "The site is one consumer of the toolchain: a zero-dep CLI that's also a Claude Code skill,
  16 tests including adversarial event-log fixtures, weekly CI refresh, and the snapshots ship
  as a documented CORS-open JSON API anyone can build on."
- Click "Fetch live from the GSA-published feed" — same transforms, recomputed in-browser.
- Show the "What is FedRAMP?" drawer: "the explainer survived — 90 seconds, every claim cited,
  each URL verified live because fedramp.gov's June restructure broke half the internet's links."

**4:10–5:00 — Close**
- "Judgment calls I'd defend: vanilla and dependency-free for reviewability; static by scope —
  a production version gets a backend, notifications, a real API service; and honesty as a
  feature — small samples labeled, exclusions counted, 'unofficial' in the masthead."
- Time spent: ~X hours, including tearing down a shipped v1 for taste. "It's the rare FedRAMP
  resource that gets more correct over time — and gives you a reason to come back."
