# A tiny static FedRAMP data API

These JSON files are pruned snapshots of **official FedRAMP data**, regenerated weekly by [a GitHub Action](../../.github/workflows/refresh-data.yml) running [`tools/fedramp-data.mjs`](../../tools/fedramp-data.mjs). GitHub Pages serves them CORS-open, so you're welcome to fetch them from your own projects:

```
https://laynr.github.io/FedRAMP/data/products.json
https://laynr.github.io/FedRAMP/data/journeys.json
https://laynr.github.io/FedRAMP/data/stats.json
https://laynr.github.io/FedRAMP/data/agencies.json
https://laynr.github.io/FedRAMP/data/activity.json
https://laynr.github.io/FedRAMP/data/ksi.json
https://laynr.github.io/FedRAMP/data/changelog.json
https://laynr.github.io/FedRAMP/data/meta.json
```

If you need guaranteed freshness or the full records, please go straight to the sources (both official, both CORS-open via raw.githubusercontent.com):

- [FedRAMP/marketplace-fedramp-gov-data](https://github.com/FedRAMP/marketplace-fedramp-gov-data) — the data feed behind marketplace.fedramp.gov (updated ~daily by GSA)
- [FedRAMP/rules](https://github.com/FedRAMP/rules) — the FedRAMP Consolidated Rules for 2026 in machine-readable form

## Files

| file | contents | source lineage |
|---|---|---|
| `products.json` | Array of all marketplace products, slimmed to 13 fields: `id, csp, cso, offering, status, impact, authType, authDate, reuse, assessor, models, deployment, agencies` (agency count) | marketplace `data.Products` |
| `journeys.json` | One record per service journey reconstructed from the status-change log: `id, csp, cso, is20x, migration, days, start, end, current, events[]` (each event: `date, to, class`). `current` is the service's latest known status computed from its **full** event chain — including delistings — not just the most recent forward step. `days` is null when no trustworthy start/end pair exists (exclusions are counted, not hidden) | computed from changelog |
| `stats.json` | Precomputed program stats: totals by status/impact, authorizations by year (all and 20x-only), count of 20x authorizations, top-reused services, most-active assessors, journey duration statistics, `lastChange` timestamp. Journey `p50` is the conventional median; `p10` and `p90` use nearest rank. | computed from `data.Products` + changelog |
| `agencies.json` | Array of federal agencies with their authorization + reuse footprint: `id, name, authorizations, reuse, auths[], reuses[]` (product ids) | marketplace agency data |
| `activity.json` | The most recent program events (status changes and agency adoptions), newest first: `date, kind, to, class, cso, csp` | computed from changelog + marketplace |
| `ksi.json` | The Key Security Indicator catalog: 10 families → indicators with official statements, mapped NIST SP 800-53 controls, and per-class variations where FedRAMP defines them | rules `KSI` section |
| `changelog.json` | Status-change events from the last 18 months, newest first: `date, csp, cso, type, path, class, from, to`. **API-only** — the site itself doesn't load this file; it ships for downstream consumers who want the raw events | changelog export |
| `meta.json` | Snapshot time plus each source's immutable Git commit, verified blob, exact URL, SHA-256 digest, byte count, upstream timestamp, and rules version | all three |

## Contract notes

- **Stability:** field names are stable within schema v2. A breaking change bumps the path
  rather than silently changing shapes. One correction shipped 2026-08-15: the journey-stats
  exclusion counter `excluded.invalidOrder` was renamed `excluded.sameDay` — after sorting, the
  only condition it can catch is a journey starting and finishing on the same day, and the old
  name misdescribed the data.
- **Sanitization:** all string values are sanitized at generation — type-checked,
  length-capped, control characters stripped, fields allowlisted. Sentinel values like
  `"Not Active"` are normalized to `null`; dates are truncated to `YYYY-MM-DD`.
- **Provenance:** generation resolves mutable branch heads to immutable 40-character Git commits,
  downloads by commit, verifies that the bytes hash to the Git blob recorded for that file at that
  commit, records a SHA-256 digest, and accepts no derived state until those checks pass. The CLI
  accepts a cached feed only when its body still matches both recorded identities.
- **Freshness caveat:** GitHub pauses scheduled workflows after ~60 days of repository
  inactivity. If the newest data here looks stale, that's the likely cause — the tool's
  in-app "fetch live" button always pulls current data directly from the upstream feeds.

## Provenance & license

Source data is published by GSA's FedRAMP program ([github.com/FedRAMP](https://github.com/FedRAMP))
and, as a U.S. Government work, is in the public domain in the United States
([17 U.S.C. § 105](https://www.govinfo.gov/link/uscode/17/105)); factual records (names, dates,
statuses) are uncopyrightable regardless. The snapshots and derived statistics here are
**unofficial** — sanitized and pruned at generation, recomputed by this project. FedRAMP® is a
registered trademark of GSA; this mirror is not licensed by, affiliated with, or endorsed by GSA.

*A convenience mirror built as a learning project, not an official FedRAMP resource. For
authoritative data, use the [official Marketplace](https://marketplace.fedramp.gov/) or the
source repositories above.*
