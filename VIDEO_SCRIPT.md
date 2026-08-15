# Video script (~5 min) — outline for recording

Suggested setup: screen-record the live site (https://laynr.github.io/FedRAMP/), webcam
optional. Times are rough; total ≈ 5:00.

**0:00–0:40 — The hook (talking over the hero)**
- "I build AI systems inside classified environments — but I'd never approached the
  government from the outside, and I had exactly zero FedRAMP experience two days ago."
- "So for this take-home I built the page I needed on day one: FedRAMP explained in the ten
  minutes you actually have."
- Point at the live badges: these numbers aren't typed in — they're computed from GSA's own
  published data, right in the browser.

**0:40–1:30 — Why this is non-obvious (scroll to 'most of what you'll google is wrong')**
- FedRAMP replaced its entire rulebook in June 2026. JAB: gone. Agency sponsors: no longer
  required. Review times: a year → about five weeks. Most content online is stale.
- "A static explainer would join that graveyard. So the medium is the message: FedRAMP 20x
  is about machine-readable, continuously-validated security — this page practices that on
  itself."

**1:30–2:30 — The 10-minute path (fast scroll-through)**
- Show: who's-who cards → a checkpoint quiz (click the right answer) → the Rev5-vs-20x table
  → the timeline with live countdowns ("these age gracefully — after the date passes they
  flip to 'opened N days ago' with no redeploy") → the class picker.

**2:30–3:30 — The KSI explorer (the tool half)**
- "This isn't a copy-paste of a blog post — it renders FedRAMP's official rules JSON. When
  the page says 46 indicators, it counted them at load."
- Tick a few indicators, show the progress ring and per-class variations, export the gap
  list. "Positioned honestly: a study aid, not an assessment."

**3:30–4:20 — The live marketplace + the data story**
- Click "Fetch live from the GSA-published feed" — 4.4 MB official feed, recomputed
  in-browser, freshness badge flips to 'live from source.'
- Show the 2025 acceleration chart and the what-changed-recently feed ("events from
  yesterday").
- "Under the hood: one set of pure transforms shared by the browser, a zero-dependency CLI
  that's also a Claude Code skill, tests, a weekly refresh workflow — and the snapshots are
  republished as a tiny public JSON API from GitHub Pages."

**4:20–5:00 — Judgment & close (talking head or sources section on screen)**
- "Rules I set: every claim cited to a URL we verified returns 200; anything unverifiable is
  flagged, not asserted; zero claims about any specific company's compliance strategy; and
  Claude tested the page itself in Chrome — clicked everything, read the console, fixed what
  it found, then did it again post-deploy."
- Time spent: ~X hours. "The thing I'm proudest of: it's the rare FedRAMP explainer that
  gets *more* correct over time, not less."
