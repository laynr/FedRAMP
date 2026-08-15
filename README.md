# FedRAMP in 10 minutes

**Live site: https://laynr.github.io/FedRAMP/**

A 10-minute, source-cited explainer of FedRAMP *as it works today* — mid-transition to
FedRAMP 20x — powered by FedRAMP's own machine-readable data instead of hand-typed facts.
Built as a take-home for Anthropic (Theme 1: Exploration & Understanding), by an engineer who
had never touched FedRAMP before this project. That's the point: it's the page I wish I'd
found on day one.

## What makes it different

1. **It can't go stale the way FedRAMP explainers always do.** The program rewrote its rules
   in June 2026, so most content online is now wrong (agency sponsors, the JAB, 12-month
   reviews — all obsolete). This page computes its numbers in the browser from the official
   GSA-published feeds, counts KSIs from the official rules JSON instead of asserting them,
   and renders date-based claims as live countdowns that age gracefully.
2. **Every factual sentence is cited** to one of 21 sources, each individually verified to
   return 200 (`node tools/check-links.mjs` — fedramp.gov's June 2026 restructure 404'd a lot
   of the internet's links).
3. **The data layer is a reusable tool, not plumbing.** A zero-dependency CLI + Claude Code
   skill (`tools/fedramp-data.mjs`, `.claude/skills/fedramp-data/`) fetches and queries the
   official feeds; its pruned snapshots are republished from `docs/data/` as a small,
   documented, CORS-open JSON API anyone can fetch ([docs/data/README.md](docs/data/README.md)).

## Architecture

```
docs/                 the site — vanilla HTML/CSS/ES modules, zero deps, no build step
  data/               pruned snapshots of official data (also a tiny public JSON API)
  js/transforms.js    pure transforms shared by browser AND CLI (one source of truth)
tools/
  fedramp-data.mjs    zero-dep CLI: fetch / products / ksi / changelog / stats / snapshot
  fedramp-data.test.mjs  unit tests + opt-in live shape checks (RUN_LIVE=1)
  check-links.mjs     verifies every cited URL returns 200
.github/workflows/refresh-data.yml   weekly: re-test, re-snapshot, commit if changed
.claude/skills/fedramp-data/         the CLI documented as a Claude Code skill
```

Data sources (all official): [FedRAMP/marketplace-fedramp-gov-data](https://github.com/FedRAMP/marketplace-fedramp-gov-data)
(the feed behind marketplace.fedramp.gov) and [FedRAMP/rules](https://github.com/FedRAMP/rules)
(the Consolidated Rules for 2026 as JSON).

## Run it

```bash
# the site (any static server)
python3 -m http.server 4173 --directory docs   # → http://localhost:4173/

# the data tool
node tools/fedramp-data.mjs snapshot           # regenerate docs/data/
node tools/fedramp-data.mjs ksi CNA            # browse KSIs in the terminal
node --test tools/*.test.mjs                   # tests (RUN_LIVE=1 for live checks)
node tools/check-links.mjs                     # citation link audit
```

## Honesty notes

This is a learning artifact, not an official resource, and it makes no claims about any
specific company's compliance strategy. Costs have no official figures and are labeled as
vendor estimates. Corrections welcome — [open an issue](https://github.com/laynr/FedRAMP/issues).

See [RATIONALE.md](RATIONALE.md) for the design write-up.
