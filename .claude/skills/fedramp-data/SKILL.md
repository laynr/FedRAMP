---
name: fedramp-data
description: Fetch and query official FedRAMP machine-readable data (marketplace products, status changelog, 2026 consolidated rules / KSIs) via the zero-dep CLI at tools/fedramp-data.mjs. Use for ANY FedRAMP data question or to refresh the site's data snapshots — never answer FedRAMP marketplace/KSI questions from training data.
---

# fedramp-data

Zero-dependency Node CLI wrapping the official FedRAMP data feeds (GSA-published, on GitHub). Run from the repo root. Data caches in `.cache/` for 6 hours; cached bodies are accepted only when they match their recorded Git blob and SHA-256 identities. Add `--force` to a `fetch` to bust the cache.

## Commands

```bash
node tools/fedramp-data.mjs fetch [--force]        # warm/refresh the cache (all 3 sources)
node tools/fedramp-data.mjs products [--status S] [--impact I] [--search Q] [--limit N] [--json]
node tools/fedramp-data.mjs ksi                    # list the 10 KSI families
node tools/fedramp-data.mjs ksi CNA                # indicators of one family (statement + NIST controls)
node tools/fedramp-data.mjs changelog [--since YYYY-MM-DD] [--limit N] [--json]
node tools/fedramp-data.mjs journeys [--fastest]   # reconstructed service journeys / fastest-to-certified
node tools/fedramp-data.mjs stats                  # program stats (counts, auths/year, top reuse...)
node tools/fedramp-data.mjs snapshot               # regenerate docs/data/*.json site bundles
```

Examples: `products --impact "20x Moderate"` · `products --search vanta --json` · `changelog --since 2026-08-01` · `journeys --fastest`

## Sources (official; verified 2026-08-15)

| source | file | home |
|---|---|---|
| marketplace | `data.json` (~4.4 MB, feeds marketplace.fedramp.gov, ~daily) | github.com/FedRAMP/marketplace-fedramp-gov-data |
| changelog | `fedramp-status-changelog.json` (~1 MB, status-change events) | same repo |
| rules | `fedramp-consolidated-rules.json` (~567 KB, FRD/FRR/KSI/CTL) | github.com/FedRAMP/rules |

## Notes

- Statuses: `FedRAMP Authorized`, `FedRAMP In Process`, `Agency In Process`, `FedRAMP Ready`. Impacts include 20x classes: `20x Low`, `20x Moderate` alongside `Low/LI-SaaS/Moderate/High`.
- Tests: `node --test tools/*.test.mjs` — runs `transforms.test.mjs` (journey/percentile fixtures) and `hostile.test.mjs` (XSS payloads, `__proto__`, oversized strings, bad dates). Add `RUN_LIVE=1` for the live shape-check. Run tests after changing any transform.
- `snapshot` writes all 8 bundles to `docs/data/` (`products`, `journeys`, `stats`, `agencies`, `activity`, `ksi`, `changelog`, `meta`) and runs an integrity guard first — it aborts rather than commit suspicious content (e.g. `<script` or `javascript:` surviving sanitization).
- The pruned bundles in `docs/data/` are public API surface (documented in `docs/data/README.md`) — don't rename fields casually.
