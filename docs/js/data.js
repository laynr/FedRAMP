/**
 * Data layer: bundled snapshot first (fast, works offline), optional live
 * refresh straight from the official GSA-published feeds (CORS-open).
 * Live refresh reuses the exact transforms the snapshot was built with.
 */

import { slimProducts, computeStats, buildJourneys, journeyStats, buildActivity, slimAgencies } from './transforms.js';

const LIVE = {
  marketplace: 'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/data.json',
  changelog: 'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/fedramp-status-changelog.json',
};

export const state = {
  products: [],
  stats: null,
  ksi: null,
  journeys: [],
  agencies: [],
  activity: [],
  meta: null,
  live: false,
  // derived maps
  productsById: new Map(),
  journeysById: new Map(),
  usersByProduct: new Map(), // productId -> [{agency, kind: 'ato'|'reuse'}]
};

function index() {
  state.productsById = new Map(state.products.map((p) => [p.id, p]));
  state.journeysById = new Map(state.journeys.map((j) => [j.id, j]));
  const users = new Map();
  for (const a of state.agencies) {
    for (const id of a.auths) {
      if (!users.has(id)) users.set(id, []);
      users.get(id).push({ agency: a.name, kind: 'ato' });
    }
    for (const id of a.reuses) {
      if (!users.has(id)) users.set(id, []);
      users.get(id).push({ agency: a.name, kind: 'reuse' });
    }
  }
  state.usersByProduct = users;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

export async function loadSnapshot() {
  const [products, stats, ksi, journeys, agencies, activity, meta] = await Promise.all(
    ['products', 'stats', 'ksi', 'journeys', 'agencies', 'activity', 'meta'].map((n) => getJSON(`data/${n}.json`))
  );
  Object.assign(state, { products, stats, ksi, journeys, agencies, activity, meta, live: false });
  index();
  return state;
}

/** Pull the full official feeds in-browser and recompute everything. */
export async function refreshLive() {
  const [mkt, cl] = await Promise.all([getJSON(LIVE.marketplace), getJSON(LIVE.changelog)]);
  const built = buildJourneys(cl);
  state.products = slimProducts(mkt);
  state.stats = { ...computeStats(mkt), journeys: journeyStats(built) };
  state.journeys = built.journeys;
  state.agencies = slimAgencies(mkt);
  state.activity = buildActivity(mkt, cl);
  state.live = true;
  index();
  return state;
}

export function freshnessLabel() {
  const lastChange = state.stats?.lastChange;
  if (!lastChange) return '';
  const days = Math.floor((Date.now() - new Date(lastChange).getTime()) / 86_400_000);
  const rel = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `${state.live ? 'live from source' : 'bundled snapshot'} · GSA data last changed ${rel}`;
}

export function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}
