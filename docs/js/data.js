/**
 * Data layer: bundled snapshot first (fast, works offline), optional live
 * refresh straight from the official GSA-published feeds (CORS-open).
 * Live refresh reuses the exact transforms the snapshot was built with.
 */

import { slimProducts, computeStats, pruneChangelog } from './transforms.js';

const LIVE = {
  marketplace: 'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/data.json',
  changelog: 'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/fedramp-status-changelog.json',
};

export const state = {
  products: [],
  stats: null,
  ksi: null,
  changelog: [],
  meta: null,
  live: false, // true once refreshed from source in-browser
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

export async function loadSnapshot() {
  const [products, stats, ksi, changelog, meta] = await Promise.all([
    getJSON('data/products.json'),
    getJSON('data/stats.json'),
    getJSON('data/ksi.json'),
    getJSON('data/changelog.json'),
    getJSON('data/meta.json'),
  ]);
  Object.assign(state, { products, stats, ksi, changelog, meta, live: false });
  return state;
}

/** Pull the full official feeds in-browser and recompute everything. */
export async function refreshLive() {
  const [mkt, cl] = await Promise.all([getJSON(LIVE.marketplace), getJSON(LIVE.changelog)]);
  state.products = slimProducts(mkt);
  state.stats = computeStats(mkt);
  state.changelog = pruneChangelog(cl, { since: isoMonthsAgo(18) });
  state.live = true;
  return state;
}

export function isoMonthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function freshnessLabel() {
  const lastChange = state.stats?.lastChange;
  if (!lastChange) return '';
  const when = new Date(lastChange);
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  const rel = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `${state.live ? 'live from source' : 'bundled snapshot'} · GSA data last changed ${rel} (${lastChange.slice(0, 10)})`;
}
