/**
 * Watchlist: star services, and on your next visit lead with what changed.
 * Pure logic (fingerprints + diff) is exported for tests; storage is a thin
 * versioned wrapper — schema bumps migrate or reset explicitly, never crash.
 *
 * localStorage is treated as untrusted input (shared-machine scenario):
 * ids are re-validated against the marketplace id format on every load and
 * fingerprint values are type/length-checked. Fingerprint maps use
 * Object.create(null) so hostile keys like "__proto__" stay inert data.
 */

// Same guarded-storage contract as ui.js `storage` (Safari private mode throws
// on ANY localStorage access). Kept local — NOT imported from ui.js — because
// this module is also imported by the Node test suite, where ui.js's
// top-level matchMedia() call would crash. The try/catch also makes the
// module import-safe in Node (no global localStorage → get() returns null).
const storage = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); return true; } catch { return false; }
  },
};

const KEY = 'fedramp-watchlist';
const SCHEMA = 2; // v2: {schema, starred: [id], fingerprints: {id: fp}, savedAt}

/** Marketplace id format — anything else is dropped on load. */
export const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

const isSafeId = (id) => typeof id === 'string' && SAFE_ID.test(id);
const cleanField = (v) => (typeof v === 'string' && v.length <= 200 ? v : null);

function cleanFingerprint(fp) {
  return {
    status: cleanField(fp?.status),
    impact: cleanField(fp?.impact),
    latest: cleanField(fp?.latest),
    latestDate: cleanField(fp?.latestDate),
  };
}

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
 * Returns [{id, changes: [{field, from, to}]}] — only entries with changes;
 * `from` may be null (no previously recorded value). A service that had real
 * data but is absent from `current` (delisted or gone from the feed) is
 * reported as a `listed` change, never dropped.
 */
export function diffFingerprints(saved, current) {
  const out = [];
  for (const [id, oldFp] of Object.entries(saved ?? {})) {
    const newFp = current?.[id];
    if (!newFp) {
      const hadData = oldFp != null && (oldFp.status != null || oldFp.impact != null || oldFp.latest != null);
      if (hadData) out.push({ id, changes: [{ field: 'listed', from: 'listed', to: 'no longer in the feed' }] });
      continue;
    }
    const changes = [];
    for (const field of ['status', 'impact', 'latest']) {
      // Report whenever the CURRENT value exists and differs — including
      // null → value: a watched service gaining its first recorded status
      // (e.g. → "FedRAMP Authorized") is the transition this feature exists
      // to catch, not a non-event.
      if (newFp[field] != null && (oldFp?.[field] ?? null) !== newFp[field]) {
        changes.push({ field, from: oldFp?.[field] ?? null, to: newFp[field] });
      }
    }
    // A re-dated event with the SAME status text (a fresh "In Process" row,
    // say) is still movement; reported only when `latest` didn't already.
    if (
      newFp.latestDate != null &&
      (oldFp?.latestDate ?? null) !== newFp.latestDate &&
      !changes.some((c) => c.field === 'latest')
    ) {
      changes.push({ field: 'latestDate', from: oldFp?.latestDate ?? null, to: newFp.latestDate });
    }
    if (changes.length) out.push({ id, changes });
  }
  return out;
}

function emptyState() {
  return { schema: SCHEMA, starred: [], fingerprints: Object.create(null), savedAt: null };
}

export function loadWatchlist() {
  try {
    const raw = JSON.parse(storage.get(KEY) ?? 'null');
    // v1 stored a bare (unversioned) array of ids — check BEFORE the object
    // guard, otherwise arrays fail the `starred` check and migration is dead code.
    if (Array.isArray(raw)) return { ...emptyState(), starred: raw.filter(isSafeId) };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.starred)) return emptyState();
    const starred = raw.starred.filter(isSafeId);
    const fingerprints = Object.create(null);
    if (raw.schema === SCHEMA && raw.fingerprints && typeof raw.fingerprints === 'object') {
      for (const id of starred) {
        if (Object.prototype.hasOwnProperty.call(raw.fingerprints, id)) {
          fingerprints[id] = cleanFingerprint(raw.fingerprints[id]);
        }
      }
    }
    const savedAt =
      raw.schema === SCHEMA && typeof raw.savedAt === 'string' && raw.savedAt.length <= 40 ? raw.savedAt : null;
    return { schema: SCHEMA, starred, fingerprints, savedAt };
  } catch {
    return emptyState();
  }
}

/**
 * Persist. `savedAt` means "when did the user last SEE this page", not "when
 * did we last write" — it only advances via markVisited() (or an explicit
 * advanceSavedAt), so the "since your last visit (3d ago)" label survives
 * mid-session fingerprint commits.
 */
export function saveWatchlist(state, { advanceSavedAt = false } = {}) {
  const savedAt = advanceSavedAt ? new Date().toISOString() : state.savedAt ?? null;
  storage.set(KEY, JSON.stringify({ ...state, schema: SCHEMA, savedAt }));
}

/** Record "the user visited now". Call ONCE per page load, after diffs render. */
export function markVisited(state) {
  const next = { ...state, savedAt: new Date().toISOString() };
  saveWatchlist(next);
  return next;
}

export function toggleStar(state, id) {
  const starred = state.starred.includes(id) ? state.starred.filter((x) => x !== id) : [...state.starred, id];
  return { ...state, starred };
}

/**
 * Refresh fingerprints for the starred set from current data maps.
 * A starred service missing from the current feed KEEPS its old fingerprint —
 * overwriting with nulls would silently destroy the "no longer listed" signal.
 */
export function refreshFingerprints(state, productsById, journeysById) {
  const fingerprints = Object.create(null);
  for (const id of state.starred) {
    fingerprints[id] = productsById.has(id)
      ? fingerprint(productsById.get(id), journeysById.get(id))
      : state.fingerprints?.[id] ?? fingerprint(undefined, undefined);
  }
  return { ...state, fingerprints };
}
