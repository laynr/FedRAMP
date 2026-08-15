/**
 * Watchlist: star services, and on your next visit lead with what changed.
 * Pure logic (fingerprints + diff) is exported for tests; storage is a thin
 * versioned wrapper — schema bumps migrate or reset explicitly, never crash.
 */

const KEY = 'fedramp-watchlist';
const SCHEMA = 2; // v2: {schema, starred: [id], fingerprints: {id: fp}, savedAt}

/** What we remember about a watched service between visits. */
export function fingerprint(product, journey) {
  return {
    status: product?.status ?? null,
    impact: product?.impact ?? null,
    latest: journey?.events?.[journey.events.length - 1]?.to ?? null,
    latestDate: journey?.events?.[journey.events.length - 1]?.date ?? null,
  };
}

/**
 * Compare saved fingerprints against current data.
 * Returns [{id, changes: [{field, from, to}]}] — only entries with changes.
 */
export function diffFingerprints(saved, current) {
  const out = [];
  for (const [id, oldFp] of Object.entries(saved ?? {})) {
    const newFp = current[id];
    if (!newFp) continue; // service vanished from feed — surfaced separately if ever needed
    const changes = [];
    for (const field of ['status', 'impact', 'latest']) {
      if (oldFp?.[field] != null && newFp[field] != null && oldFp[field] !== newFp[field]) {
        changes.push({ field, from: oldFp[field], to: newFp[field] });
      }
    }
    if (changes.length) out.push({ id, changes });
  }
  return out;
}

function emptyState() {
  return { schema: SCHEMA, starred: [], fingerprints: {}, savedAt: null };
}

export function loadWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.starred)) return emptyState();
    if (raw.schema !== SCHEMA) {
      // v1 (unversioned array of ids) → migrate stars, drop fingerprints
      if (Array.isArray(raw)) return { ...emptyState(), starred: raw };
      return { ...emptyState(), starred: raw.starred ?? [] };
    }
    return { ...emptyState(), ...raw };
  } catch {
    return emptyState();
  }
}

export function saveWatchlist(state) {
  localStorage.setItem(KEY, JSON.stringify({ ...state, schema: SCHEMA, savedAt: new Date().toISOString() }));
}

export function toggleStar(state, id) {
  const starred = state.starred.includes(id) ? state.starred.filter((x) => x !== id) : [...state.starred, id];
  return { ...state, starred };
}

/** Refresh fingerprints for the starred set from current data maps. */
export function refreshFingerprints(state, productsById, journeysById) {
  const fingerprints = {};
  for (const id of state.starred) {
    fingerprints[id] = fingerprint(productsById.get(id), journeysById.get(id));
  }
  return { ...state, fingerprints };
}
