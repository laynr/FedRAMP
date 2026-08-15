# A tiny static FedRAMP data API

These JSON files are pruned snapshots of **official FedRAMP data**, regenerated weekly by [a GitHub Action](../../.github/workflows/refresh-data.yml) running [`tools/fedramp-data.mjs`](../../tools/fedramp-data.mjs). GitHub Pages serves them CORS-open, so you're welcome to fetch them from your own projects:

```
https://laynr.github.io/FedRAMP/data/products.json
https://laynr.github.io/FedRAMP/data/stats.json
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
| `stats.json` | Precomputed program stats: totals by status/impact, authorizations by year, count of 20x authorizations, top-reused services, most-active assessors, `lastChange` timestamp | computed from `data.Products` |
| `ksi.json` | The Key Security Indicator catalog: 10 families → indicators with official statements, mapped NIST SP 800-53 controls, and per-class variations where FedRAMP defines them | rules `KSI` section |
| `changelog.json` | Status-change events from the last 18 months, newest first: `date, csp, cso, type, path, class, from, to` | changelog export |
| `meta.json` | When this snapshot was generated + upstream freshness timestamps and rules version | all three |

Sentinel values like `"Not Active"` are normalized to `null`; dates are truncated to `YYYY-MM-DD`.

*This is a convenience mirror built as a learning project, not an official FedRAMP resource.*
