# FedRAMP — unofficial explorer

A take-home project for Anthropic's Public Sector Staff+ SWE role: a live, tool-first app for
exploring FedRAMP (watchlist, journeys, duration analytics, KSI study aid) plus a Learn page,
all built on FedRAMP's own machine-readable data. Hosted on GitHub Pages.

- **Live site:** https://laynr.github.io/FedRAMP/ (served from `main:/docs`, no build step)
- **Assignment:** `anthropic-swe-take-home-assignment.md` (paraphrase; Theme 1: Exploration & Understanding)

## Architecture

- `docs/` — the entire site. Vanilla HTML/CSS/ES modules, **zero dependencies, no build step**. Hand-rolled SVG charts. `index.html` is the tool (views in `docs/js/views/`), `learn.html` the explainer, `about.html` sources & method.
- `docs/js/transforms.js` — pure transforms (journey engine, percentiles, sanitize boundary) shared byte-for-byte between the CLI and the browser.
- `docs/data/` — pruned snapshots of official FedRAMP data (also a documented, CORS-open static data API — see `docs/data/README.md`; field names are public API surface).
- `tools/fedramp-data.mjs` — zero-dep Node CLI that fetches/queries official sources and writes the snapshots. Documented as a Claude Code skill in `.claude/skills/fedramp-data/`. Tests: `node --test tools/*.test.mjs`.
- `.github/workflows/` — `ci.yml` (tests on push/PR), `links.yml` (scheduled link audit), `refresh-data.yml` (weekly data refresh), `pages.yml` (Pages deploy via Actions).

## Non-negotiable content rules

1. **Official sources only, every claim cited.** No claims from model training data. The verified-URL list lives in `docs/js/sources.js`; fedramp.gov was restructured June 2026 and many indexed URLs now 404 — never add a link without checking it returns 200.
2. **No claims about any specific CSP's strategy or status** — especially Anthropic. No Anthropic-specific content on the site (owner decision, 2026-08-15).
3. **Humble tone.** The readers (Anthropic reviewers, FedRAMP practitioners) are the experts. The site is a learner's cited synthesis: flag what's unverified, call tools "study aids, not assessments," invite corrections via GitHub issues.
4. **Dates age gracefully.** Anything date-dependent (countdowns, "opens in N days") must compute client-side and read correctly after the date passes.

## Data sources (all official, verified 2026-08-15)

- `github.com/FedRAMP/marketplace-fedramp-gov-data` — `data.json` (~4.4 MB, feeds marketplace.fedramp.gov, updated ~daily), `fedramp-status-changelog.json`. CORS-open via raw.githubusercontent.com / cdn.jsdelivr.net.
- `github.com/FedRAMP/rules` — `fedramp-consolidated-rules.json` (~567 KB): canonical 2026 rulebook (FRD/FRR/KSI/CTL).
- Use the `fedramp-data` skill for all data work (dogfooding is deliberate).

## Lessons learned (hard-won; don't relearn these)

- **fedramp.gov link rot is pervasive** since the June-2026 site restructure. Never cite an
  unchecked URL; run `node tools/check-links.mjs` after touching any citation.
- **jsDelivr caches `@main` for ~12 hours.** Freshness claims must account for it; the
  raw.githubusercontent fallback in `docs/js/feeds.js` exists for exactly this reason.
- **Pushes made with `GITHUB_TOKEN` do not trigger Pages branch deploys.** That's why Pages
  deploys through the Actions flow (`pages.yml`), not the branch-publish path.
- **Node 22 `node --test tools/` does not glob** — it errors on the directory. Always use
  `node --test tools/*.test.mjs`.
- **Feed data is hostile input.** Sanitize at the transforms boundary, `esc()` at every
  `innerHTML` sink, CSP meta on every page. Never interpolate a feed string raw — even ones
  that "look safe" (30 real products contain `&` today; tomorrow's could contain worse).
- **Data quirks:** marketplace impact levels include `20x Low` / `20x Moderate`; changelog
  `cert_type` / `cert_path` values include the literal string `20x`. Match accordingly.
- **Percentile is nearest-rank: `ceil(p * n / 100) - 1`.** We shipped `floor()` first and it
  skewed the headline median — an off-by-one-rank that survived until the hardening review.
