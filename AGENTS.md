# Working with AI agents on this repo

This project was built with Claude Code, and the way agents were *directed* is part of the
story (see `RATIONALE.md`). This file captures the practices that worked, so a future session —
human or agent — can repeat them. It complements `CLAUDE.md` (which holds the project's facts and
rules); this file is about process.

## The adversarial review loop

Before shipping, run read-only reviews with narrow mandates, then integrate findings in one
place. Useful lenses are correctness, security, content/UX, accessibility, government-data
policy, and rubric fit. Require file-and-line evidence; accepted correctness findings should
ship with focused regressions.

## Fan-out rules that avoided collisions

- **Disjoint file ownership.** When running write-agents in parallel, assign each an exclusive
  set of files and state the contract between them (e.g. "Agent V makes `.svc-row` a button;
  Agent L styles `.svc-item`"). Two agents editing one file corrupts both.
- **Waves, not a swarm.** Foundational modules (transforms, shared UI primitives, feeds) go in
  wave 1; consumers (views, pages, docs that quote regenerated numbers) go in wave 2 after the
  first wave merges. Integrate and sanity-check between waves.
- **Placeholder tokens for values that change downstream.** Docs referenced regenerated stats as
  `STATS_TBD_*` tokens; the integrator filled them once after data regeneration, so no agent
  hard-coded a number that a later fix would falsify.
- **One integrator (the main loop).** Only the main session regenerates data, fills tokens,
  resolves cross-agent seams, runs the full verification, and commits. Sub-agents never commit.

## Verification gates (nothing ships unverified)

- `node --test tools/*.test.mjs` green, including `tools/hostile.test.mjs` (feed treated as
  hostile input) and the data-cite↔sources consistency check in CI.
- `node tools/check-links.mjs` — every cited URL 200 across all pages + the source registry.
- Closed-loop browser pass via Claude-in-Chrome: zero console errors on every view/page;
  keyboard-only walkthrough; the **accessibility tree** (`read_page`) inspected as the
  screen-reader's-eye view; a **poisoned-data test** (inject XSS payloads into every field,
  assert nothing executes and no unexpected network request fires); dark + light; mobile.
- Regenerate `docs/data/` with the fixed transforms *before* quoting any number.

## Guardrails a builder must set (agents won't invent these)

- **Cited or cut** — every factual claim links to a verified source; enforced in CI.
- **No claims about any specific company's compliance strategy.**
- **Humble tone** — the readers are the domain experts; flag uncertainty, never overclaim.
- **Trademark/branding** — the product name is "OnRamp"; "FedRAMP" is descriptive only; no logo.
