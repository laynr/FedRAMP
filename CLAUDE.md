# FedRAMP in 10 Minutes

A take-home project for Anthropic's Public Sector Staff+ SWE role: an interactive explainer + live-data tools for understanding FedRAMP, hosted on GitHub Pages.

- **Live site:** https://laynr.github.io/FedRAMP/ (served from `main:/docs`, no build step)
- **Assignment:** `anthropic-swe-take-home-assignment.md` (Theme 1: Exploration & Understanding)

## Architecture

- `docs/` — the entire site. Vanilla HTML/CSS/ES modules, **zero dependencies, no build step**. Hand-rolled SVG charts.
- `docs/data/` — pruned snapshots of official FedRAMP data (also a documented, CORS-open static data API — see `docs/data/README.md`).
- `tools/fedramp-data.mjs` — zero-dep Node CLI that fetches/queries official sources and writes the snapshots. Documented as a Claude Code skill in `.claude/skills/fedramp-data/`. Tests: `node --test tools/`.
- `.github/workflows/refresh-data.yml` — weekly data refresh.

## Non-negotiable content rules

1. **Official sources only, every claim cited.** No claims from model training data. The verified-URL list lives in `docs/js/sources.js`; fedramp.gov was restructured June 2026 and many indexed URLs now 404 — never add a link without checking it returns 200.
2. **No claims about any specific CSP's strategy or status** — especially Anthropic. No Anthropic-specific content on the site (owner decision, 2026-08-15).
3. **Humble tone.** The readers (Anthropic reviewers, FedRAMP practitioners) are the experts. The site is a learner's cited synthesis: flag what's unverified, call tools "study aids, not assessments," invite corrections via GitHub issues.
4. **Dates age gracefully.** Anything date-dependent (countdowns, "opens in N days") must compute client-side and read correctly after the date passes.

## Data sources (all official, verified 2026-08-15)

- `github.com/FedRAMP/marketplace-fedramp-gov-data` — `data.json` (~4.4 MB, feeds marketplace.fedramp.gov, updated ~daily), `fedramp-status-changelog.json`. CORS-open via raw.githubusercontent.com / cdn.jsdelivr.net.
- `github.com/FedRAMP/rules` — `fedramp-consolidated-rules.json` (~567 KB): canonical 2026 rulebook (FRD/FRR/KSI/CTL).
- Use the `fedramp-data` skill for all data work (dogfooding is deliberate).
