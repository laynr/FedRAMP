/**
 * Data layer: bundled snapshot first (fast, works offline), optional live
 * refresh straight from the official GSA-published feeds (CORS-open).
 * Live refresh reuses the exact transforms the snapshot was built with.
 *
 * Hardening: every fetch is bounded (timeout + size cap + content-type sanity),
 * live refresh is atomic (all transforms run into a local object, validated,
 * then swapped in one assignment — a failed refresh leaves state untouched),
 * and views subscribe via onStateChange so nothing renders stale data.
 */

import { slimProducts, computeStats, buildJourneys, journeyStats, buildActivity, slimAgencies } from './transforms.js';
import { FEEDS, FETCH_LIMITS } from './feeds.js';

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

// ---------- change subscription (views re-render on snapshot load AND live refresh) ----------

const listeners = new Set();

/** Subscribe to state swaps. Returns an unsubscribe function. */
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('state-change listener failed', err);
    }
  }
}

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

// ---------- fetch hygiene ----------

/**
 * Bounded JSON fetch: timeout, content-length precheck, post-download size
 * check before JSON.parse, and a content-type sanity check. Note that
 * raw.githubusercontent.com serves JSON as text/plain — accepted deliberately.
 */
async function getJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (type && !/(json|octet-stream|text\/plain)/.test(type)) {
    throw new Error(`unexpected content-type "${type}" for ${url}`);
  }
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > FETCH_LIMITS.maxBytes) {
    throw new Error(`response too large (${declared} bytes declared) for ${url}`);
  }
  const text = await res.text();
  if (text.length > FETCH_LIMITS.maxBytes) {
    throw new Error(`response too large (${text.length} chars) for ${url}`);
  }
  return JSON.parse(text);
}

/** Try each configured URL for a feed in order (CDN first, raw fallback). */
async function getFeed(name) {
  let lastErr = null;
  for (const url of FEEDS[name].urls) {
    try {
      return await getJSON(url);
    } catch (err) {
      lastErr = err;
      console.warn(`feed "${name}" fetch failed for ${url} — trying next source`, err);
    }
  }
  throw lastErr ?? new Error(`no URLs configured for feed "${name}"`);
}

// ---------- loading ----------

export async function loadSnapshot() {
  const [products, stats, ksi, journeys, agencies, activity, meta] = await Promise.all(
    ['products', 'stats', 'ksi', 'journeys', 'agencies', 'activity', 'meta'].map((n) => getJSON(`data/${n}.json`))
  );
  Object.assign(state, { products, stats, ksi, journeys, agencies, activity, meta, live: false });
  index();
  emitChange();
  return state;
}

/**
 * Pull the full official feeds in-browser and recompute everything.
 * Atomic: all transforms run into `next` and are shape-validated BEFORE the
 * single Object.assign — any throw leaves the current state fully intact.
 */
export async function refreshLive() {
  const [mkt, cl] = await Promise.all([getFeed('marketplace'), getFeed('changelog')]);
  const built = buildJourneys(cl);
  const next = {
    products: slimProducts(mkt),
    stats: { ...computeStats(mkt), journeys: journeyStats(built) },
    journeys: built.journeys,
    agencies: slimAgencies(mkt),
    activity: buildActivity(mkt, cl),
    live: true,
  };
  if (!Array.isArray(next.products) || next.products.length === 0) {
    throw new Error('live refresh produced no products — keeping current data');
  }
  if (!next.stats?.totals) {
    throw new Error('live refresh produced no stats totals — keeping current data');
  }
  if (!Array.isArray(next.journeys)) {
    throw new Error('live refresh produced no journeys — keeping current data');
  }
  Object.assign(state, next);
  index();
  emitChange();
  return state;
}

// ---------- formatting helpers ----------

export function relativeDate(iso) {
  const t = new Date(`${iso}T12:00:00`).getTime();
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

export function freshnessLabel() {
  const lastChange = state.stats?.lastChange;
  if (typeof lastChange !== 'string') return '';
  const rel = relativeDate(lastChange.slice(0, 10));
  if (!rel) return '';
  return `${state.live ? 'live from source' : 'bundled snapshot'} · GSA data last changed ${rel}`;
}
