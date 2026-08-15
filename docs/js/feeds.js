/**
 * Single source of truth for the official FedRAMP feed endpoints, shared by
 * the browser data layer (docs/js/data.js) and the CLI (tools/fedramp-data.mjs).
 * Browser-safe ESM — no Node imports.
 *
 * URL order is deliberate: jsDelivr caches @main for ~12h (fast, CORS-open,
 * generous limits) — the raw.githubusercontent fallback is fresher but rate-limited.
 */

export const FEEDS = {
  marketplace: {
    urls: [
      'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/data.json',
      'https://raw.githubusercontent.com/FedRAMP/marketplace-fedramp-gov-data/main/data.json',
    ],
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  changelog: {
    urls: [
      'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/fedramp-status-changelog.json',
      'https://raw.githubusercontent.com/FedRAMP/marketplace-fedramp-gov-data/main/fedramp-status-changelog.json',
    ],
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  rules: {
    urls: [
      'https://cdn.jsdelivr.net/gh/FedRAMP/rules@main/fedramp-consolidated-rules.json',
      'https://raw.githubusercontent.com/FedRAMP/rules/main/fedramp-consolidated-rules.json',
    ],
    home: 'https://github.com/FedRAMP/rules',
  },
};

/** Shared fetch hygiene limits: reject oversized responses, bound every request. */
export const FETCH_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  timeoutMs: 30_000,
};
