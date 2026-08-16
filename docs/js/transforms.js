/**
 * Pure transforms over the official FedRAMP feeds.
 * Shared by the browser (docs/js/*) and the Node CLI (tools/fedramp-data.mjs),
 * so the site's "live refresh" and the build-time snapshots can never disagree.
 *
 * SECURITY: this module is the single sanitization boundary for hostile
 * upstream input. Both the CLI snapshots and the browser's live refresh
 * funnel every feed through these transforms, so every string is
 * type-checked, control-char-stripped and length-capped HERE, every id must
 * match a strict pattern, and every date must be a real calendar date in a
 * sane range. Sanitization here is about type/length/shape — HTML escaping
 * is the renderer's job (see esc() in docs/js/ui.js); a poisoned feed can at
 * worst produce weird-looking text, never oversized payloads, control
 * characters, forged ids, or prototype pollution.
 *
 * Feed shapes verified against the real data 2026-08-15; see docs/data/README.md.
 */

/* ======================= sanitize layer ======================= */

const NAME_MAX = 300; // names, statuses, org strings
const STMT_MAX = 2000; // KSI statements
// C0 controls (0x00-0x1F), DEL (0x7F), and C1 controls (0x80-0x9F).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** Must be a string → strip control chars, trim, cap length; anything else → null. */
const cleanStr = (v, max = NAME_MAX) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(CONTROL_CHARS, '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

// Real ids seen in the feeds: F1607067912, FR2315464863, AGENCYAMAZONEW, 22-012.
const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Must match the strict id pattern (and never a prototype-polluting key) → else null. */
const cleanId = (v) => (typeof v === 'string' && ID_RE.test(v) && !FORBIDDEN_KEYS.has(v) ? v : null);

/** Non-negative finite integer, else the fallback. Bounds hostile numerics. */
const cleanCount = (v, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.trunc(v), 1_000_000_000) : fallback;

const DATE_MIN = '1990-01-01'; // FedRAMP didn't exist before 2011; generous floor

/**
 * Strict date: `YYYY-MM-DD` prefix, a REAL calendar date (Date.UTC round-trip,
 * so 2026-02-31 and 9999-99-99 are rejected), within [1990-01-01, today+1d].
 */
const dateOrNull = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const s = v.slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  if (s < DATE_MIN) return null;
  if (s > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return null;
  return s;
};

/** Strict sortable UTC timestamp for changelog recording order; invalid → empty. */
const recordedTimeOrEmpty = (v) => {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z)?$/.test(s)) return '';
  const date = dateOrNull(s);
  if (!date) return '';
  return s.length === 10 ? `${date}T00:00:00.000Z` : new Date(s).toISOString();
};

/** The feed uses the literal string "Not Active" as its null sentinel. */
const notSentinel = (s) => (s && s !== 'Not Active' ? s : null);

/** Total-order string comparator (ISO dates compare correctly as strings). */
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ======================= products ======================= */

/** Slim the 43-field marketplace product records down to what the site uses. */
export function slimProducts(marketplace) {
  const products = Array.isArray(marketplace?.data?.Products) ? marketplace.data.Products : [];
  const out = [];
  for (const p of products) {
    if (p === null || typeof p !== 'object') continue;
    const id = cleanId(p.id);
    if (!id) continue; // no trustworthy id → drop the record
    out.push({
      id,
      csp: cleanStr(p.csp),
      cso: cleanStr(p.cso),
      offering: cleanStr(p.service_offering),
      status: cleanStr(p.status),
      impact: cleanStr(p.impact_level),
      authType: notSentinel(cleanStr(p.auth_type)),
      authDate: dateOrNull(p.auth_date),
      reuse: cleanCount(p.reuse),
      assessor: notSentinel(cleanStr(p.independent_assessor)),
      models: Array.isArray(p.service_model) ? p.service_model.map((m) => cleanStr(m)).filter(Boolean) : [],
      deployment: cleanStr(p.deployment_model),
      agencies: Array.isArray(p.agency_authorizations) ? p.agency_authorizations.length : 0,
    });
  }
  return out;
}

/** Tally by key. Built via Map so hostile keys can't touch any prototype. */
const count = (arr, key) => {
  const tally = new Map();
  for (const item of arr) {
    const k = key(item);
    if (k == null) continue;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return Object.fromEntries(tally);
};

export const is20x = (p) => typeof p.impact === 'string' && p.impact.startsWith('20x');

/** Program-level statistics computed from the full marketplace feed. */
export function computeStats(marketplace) {
  const slim = slimProducts(marketplace);
  const authorized = slim.filter((p) => p.status === 'FedRAMP Authorized');
  return {
    lastChange: cleanStr(marketplace?.meta?.last_change, 64),
    totals: {
      products: slim.length,
      byStatus: count(slim, (p) => p.status),
      byImpact: count(slim, (p) => p.impact),
      authorized20x: authorized.filter(is20x).length,
    },
    authsByYear: count(authorized, (p) => p.authDate?.slice(0, 4)),
    authsByYear20x: count(authorized.filter(is20x), (p) => p.authDate?.slice(0, 4)),
    topReused: [...authorized]
      .sort((a, b) => b.reuse - a.reuse || cmpStr(a.id, b.id))
      .slice(0, 15)
      .map((p) => ({ cso: p.cso, csp: p.csp, reuse: p.reuse, impact: p.impact })),
    topAssessors: Object.entries(count(authorized, (p) => p.assessor))
      .sort((a, b) => b[1] - a[1] || cmpStr(a[0], b[0]))
      .slice(0, 10)
      .map(([name, n]) => ({ name, count: n })),
  };
}

/* ======================= KSI catalog ======================= */

/** Prune the consolidated rules file to the KSI catalog the site renders. */
export function pruneKsi(rules) {
  const families = [];
  for (const fam of Object.values(rules?.KSI ?? {})) {
    if (fam === null || typeof fam !== 'object') continue;
    const famId = cleanId(fam.id);
    if (!famId) continue;
    const indicators = [];
    for (const [rawId, ind] of Object.entries(fam.indicators ?? {})) {
      const id = cleanId(rawId);
      if (!id || ind === null || typeof ind !== 'object') continue;
      indicators.push({
        id,
        name: cleanStr(ind.name),
        statement: cleanStr(ind.statement, STMT_MAX),
        controls: Array.isArray(ind.controls) ? ind.controls.map((c) => cleanId(c)).filter(Boolean) : [],
        // per-class statement overrides, when FedRAMP varies an indicator by class
        classes: cleanClassVariants(ind.varies_by_class),
      });
    }
    families.push({
      id: famId,
      name: cleanStr(fam.name),
      short: cleanStr(fam.short_name, 64),
      status: cleanStr(fam.status, 64),
      indicators,
    });
  }
  return {
    version: cleanStr(rules?.info?.version, 64),
    updated: dateOrNull(rules?.info?.last_updated),
    families,
  };
}

/** Sanitize the {classKey: {statement}} variation map; hostile keys dropped. */
function cleanClassVariants(varies) {
  if (varies === null || varies === undefined || typeof varies !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(varies)) {
    const key = cleanId(k);
    if (!key || v === null || typeof v !== 'object') continue;
    out[key] = { statement: cleanStr(v.statement, STMT_MAX) };
  }
  return Object.keys(out).length ? out : null;
}

/* ======================= journey engine =======================
 * The status changelog is messy real-world event data: migration-era backfill
 * (source:"migration", coarse dates), out-of-order rows, duplicate transitions,
 * journeys missing a start or an end, and a mixed vocabulary of 15 statuses.
 * Invariants enforced here:
 *   1. events are sorted by transition date, then recorded timestamp. When
 *      both are identical (common in migration batches), lifecycle rank and
 *      the remaining sanitized fields provide a deterministic total order
 *   2. consecutive duplicates (same date + same to_status) collapse to one
 *   3. an "end" is the FIRST event matching END_STATUS; the "start" is the
 *      first event BEFORE it matching START_STATUS. Pre-process designations
 *      (FedRAMP Ready / "FRR") stay in the events chain — they're real
 *      history — but they do not start the clock
 *   4. duration (days) exists only when start < end; everything else is
 *      excluded and COUNTED, never silently dropped
 *   5. migration-sourced journeys are flagged (their early dates are coarser)
 *   6. `current` is the last event of the FULL chain, delistings included —
 *      a delisted service must never report its old status as current
 * Vocabulary verified against the live feed 2026-08-15.
 */

// Authorized, FedRAMP Certified, FedRAMP Certified (In Remediation)
export const END_STATUS = /^(authorized$|fedramp certified)/i;
export const isEndStatus = (s) => typeof s === 'string' && END_STATUS.test(s);

// In-process-type statuses that start the clock. Matches the verified
// vocabulary: JAB Review, Agency Review, PMO Review, Initial Program Review,
// Final Program Review, FedRAMP In Process, Agency In Process, Agency
// Authorization In Process, Initial Implementation — and deliberately
// EXCLUDES "FRR" (FedRAMP Ready, a pre-process readiness designation).
export const START_STATUS = /(in process|review|initial implementation)/i;

const DELISTED = /no status found/i;
const EXPLICIT_DELISTED = /no status found.*delisted/i;

// Lifecycle rank for events whose effective and recorded timestamps are
// identical. It covers the complete vocabulary observed in the live feed.
const statusRank = (s) => {
  if (EXPLICIT_DELISTED.test(s)) return 90;
  if (/^no status found$/i.test(s)) return 0;
  if (/^frr$/i.test(s)) return 10;
  if (/^initial implementation$/i.test(s)) return 20;
  if (/^(agency|jab) review$/i.test(s)) return 30;
  if (/in process$/i.test(s)) return 40;
  if (/^pmo review$/i.test(s)) return 50;
  if (/^initial program review$/i.test(s)) return 60;
  if (/^final program review$/i.test(s)) return 70;
  if (isEndStatus(s)) return 80;
  return 45;
};

// `Program` alone is NOT a 20x marker: the changelog also uses that path for
// pre-20x Rev5 journeys. Require the feed's explicit 20x type/path value.
const isPath20x = (e) => e.type === '20x' || e.path === '20x';

/** Build per-product journeys from the raw changelog. Returns {journeys, excluded}. */
export function buildJourneys(changelog) {
  const rows = Array.isArray(changelog?.data?.certprocessstatuschangelog)
    ? changelog.data.certprocessstatuschangelog
    : [];
  const byProduct = new Map();
  let idx = 0;
  for (const r of rows) {
    if (r === null || typeof r !== 'object') continue;
    const id = cleanId(r.product_id);
    const date = dateOrNull(r.transition_date);
    const to = cleanStr(r.to_status);
    if (!id || !date || !to) continue;
    if (!byProduct.has(id)) byProduct.set(id, { evs: [] });
    const g = byProduct.get(id);
    g.evs.push({
      date,
      to,
      csp: cleanStr(r.csp),
      cso: cleanStr(r.cso),
      class: cleanStr(r.cert_class, 64),
      path: cleanStr(r.cert_path, 64),
      type: cleanStr(r.cert_type, 64),
      source: cleanStr(r.source, 64),
      recorded: recordedTimeOrEmpty(r.recorded_date),
      idx: idx++,
    });
  }

  const journeys = [];
  const excluded = { delistedOnly: 0, noEnd: 0, noStart: 0, sameDay: 0 };

  for (const [id, group] of byProduct) {
    const evs = group.evs;
    // Later recordings override earlier ones on the same effective day. True
    // same-instant ties use lifecycle order.
    evs.sort(
      (a, b) =>
        cmpStr(a.date, b.date) ||
        cmpStr(a.recorded, b.recorded) ||
        statusRank(a.to) - statusRank(b.to) ||
        cmpStr(a.to, b.to) ||
        cmpStr(a.cso ?? '', b.cso ?? '') ||
        cmpStr(a.csp ?? '', b.csp ?? '') ||
        cmpStr(a.type ?? '', b.type ?? '') ||
        cmpStr(a.path ?? '', b.path ?? '') ||
        cmpStr(a.class ?? '', b.class ?? '') ||
        cmpStr(a.source ?? '', b.source ?? '') ||
        a.idx - b.idx
    );
    // Names can change over a product's history. Select the most recently
    // recorded non-empty identity, with deterministic fallbacks for migration
    // rows recorded in the same batch.
    const identities = evs
      .filter((e) => e.cso || e.csp)
      .sort(
        (a, b) =>
          cmpStr(a.recorded, b.recorded) ||
          cmpStr(a.date, b.date) ||
          cmpStr(a.cso ?? '', b.cso ?? '') ||
          cmpStr(a.csp ?? '', b.csp ?? '')
      );
    const latestIdentityValue = (key) => {
      for (let i = identities.length - 1; i >= 0; i--) {
        if (identities[i][key]) return identities[i][key];
      }
      return null;
    };
    const deduped = [];
    for (const e of evs) {
      const prev = deduped[deduped.length - 1];
      if (!prev || prev.date !== e.date || prev.to !== e.to) {
        deduped.push({ ...e });
        continue;
      }
      // Duplicate rows occasionally disagree on optional metadata. Preserve
      // any explicit 20x marker and migration evidence instead of making the
      // result depend on feed order.
      if (e.type === '20x') prev.type = '20x';
      if (e.path === '20x') prev.path = '20x';
      if (!prev.class) prev.class = e.class;
      if (e.source === 'migration') prev.source = 'migration';
    }

    const migration = evs.some((e) => e.source === 'migration');
    const live = deduped.filter((e) => !DELISTED.test(e.to));
    if (!live.length) {
      excluded.delistedOnly++;
      continue;
    }

    const endIdx = live.findIndex((e) => isEndStatus(e.to));
    const end = endIdx === -1 ? null : live[endIdx];
    const startIdx = end ? live.slice(0, endIdx).findIndex((e) => START_STATUS.test(e.to)) : -1;
    const start = startIdx === -1 ? null : live[startIdx];

    let days = null;
    if (!end) excluded.noEnd++;
    else if (!start) excluded.noStart++; // e.g. backfill starting at "Authorized", or FRR-only prehistory
    // sorting guarantees start.date <= end.date, so this only catches
    // journeys starting and finishing on the same day — duration unmeasurable
    else if (end.date <= start.date) excluded.sameDay++;
    else days = Math.round((new Date(end.date) - new Date(start.date)) / 86_400_000);

    // A later re-authorization must not relabel an earlier legacy completion.
    // Measured cohorts use markers only from the selected start→end interval.
    // Incomplete journeys use their live history for current-path UI, but never
    // enter duration statistics.
    const cohortEvents = start && end ? live.slice(startIdx, endIdx + 1) : live;
    const on20xPath = cohortEvents.some(isPath20x);

    journeys.push({
      id,
      csp: latestIdentityValue('csp'),
      cso: latestIdentityValue('cso'),
      is20x: on20xPath,
      migration,
      days,
      start: days != null ? start.date : null,
      end: days != null ? end.date : null,
      // full chain, delistings included — see invariant 6
      current: deduped[deduped.length - 1].to,
      events: deduped.map((e) => ({ date: e.date, to: e.to, class: e.class })),
    });
  }
  return { journeys, excluded };
}

/* ======================= journey statistics ======================= */

/** Nearest-rank percentile over an ascending-sorted array. */
const percentile = (sorted, p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];

/** Conventional sample median: midpoint of the middle pair for even n. */
const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** p10/p50/p90 for one cohort of journeys. */
const durationSplit = (list) => {
  const days = list.map((j) => j.days).sort((a, b) => a - b);
  if (!days.length) return { n: 0, p10: null, p50: null, p90: null };
  return { n: days.length, p10: percentile(days, 10), p50: median(days), p90: percentile(days, 90) };
};

const BIN = 90;
const MAXBIN = 12; // last bin is open-ended: 990+ days

/** 90-day histogram; labels are inclusive ranges (0–89, 90–179, …, 990+). */
const buildHistogram = (measured) => {
  const histogram = Array.from({ length: MAXBIN }, (_, i) => ({
    label: i === MAXBIN - 1 ? `${i * BIN}+` : `${i * BIN}–${(i + 1) * BIN - 1}`,
    count: 0,
  }));
  for (const j of measured) {
    histogram[Math.min(MAXBIN - 1, Math.floor(j.days / BIN))].count++;
  }
  return histogram;
};

/** Fastest measured journeys finishing on/after `since`, quickest first. */
const fastestSince = (measured, since, n) =>
  measured
    .filter((j) => j.end && j.end >= since)
    .sort((a, b) => a.days - b.days || cmpStr(a.id, b.id))
    .slice(0, n)
    .map((j) => ({ id: j.id, cso: j.cso, csp: j.csp, days: j.days, end: j.end, is20x: j.is20x }));

/** Duration statistics over measured journeys, split legacy vs 20x-path. */
export function journeyStats({ journeys, excluded }) {
  const measured = journeys.filter((j) => j.days != null);
  return {
    totalWithEvents: journeys.length,
    measured: measured.length,
    excluded,
    all: durationSplit(measured),
    path20x: durationSplit(measured.filter((j) => j.is20x)),
    legacy: durationSplit(measured.filter((j) => !j.is20x)),
    histogram: buildHistogram(measured),
    fastest: fastestSince(measured, '2025-01-01', 12),
  };
}

/* ======================= activity + directories ======================= */

/** Merged live-activity feed: status transitions + dated agency reuses/ATOs. */
export function buildActivity(marketplace, changelog, { limit = 120 } = {}) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 120;
  const rawProducts = Array.isArray(marketplace?.data?.Products) ? marketplace.data.Products : [];
  const products = new Map();
  for (const p of rawProducts) {
    if (p === null || typeof p !== 'object') continue;
    const id = cleanId(p.id);
    if (id) products.set(id, p);
  }
  const out = [];
  for (const e of pruneChangelog(changelog)) {
    out.push({ date: e.date, kind: 'status', to: e.to, class: e.class, cso: e.cso, csp: e.csp });
  }
  const reuses = Array.isArray(marketplace?.data?.ReuseMapping) ? marketplace.data.ReuseMapping : [];
  for (const r of reuses) {
    if (r === null || typeof r !== 'object') continue;
    const date = dateOrNull(r.auth_date) ?? dateOrNull(r.ato_date);
    const p = products.get(cleanId(r.id));
    if (!date || !p) continue;
    out.push({
      date,
      kind: 'reuse',
      agency: agencyName(r),
      cso: cleanStr(p.cso) ?? cleanStr(p.service_offering),
      csp: cleanStr(p.csp),
    });
  }
  return out
    .map((e, i) => ({ ...e, idx: i }))
    .sort((a, b) => cmpStr(b.date, a.date) || a.idx - b.idx) // newest first; ties keep build order
    .slice(0, max)
    .map(({ idx, ...e }) => e);
}

/** "Parent — Sub" display name for an agency-ish row (agencies + reuse mapping). */
const agencyName = (row) => {
  const parent = cleanStr(row.parent);
  const sub = cleanStr(row.sub);
  return parent && sub ? `${parent} — ${sub}` : parent;
};

/** Slim agency directory; product references are ids, resolved client-side. */
export function slimAgencies(marketplace) {
  const agencies = Array.isArray(marketplace?.data?.Agencies) ? marketplace.data.Agencies : [];
  const out = [];
  for (const a of agencies) {
    if (a === null || typeof a !== 'object') continue;
    const id = cleanId(a.id);
    if (!id) continue;
    out.push({
      id,
      name: agencyName(a),
      authorizations: cleanCount(a.authorization),
      reuse: cleanCount(a.reuse),
      auths: Array.isArray(a.auths) ? a.auths.map((x) => cleanId(x?.id)).filter(Boolean) : [],
      reuses: Array.isArray(a.reuses) ? a.reuses.map((x) => cleanId(x?.id)).filter(Boolean) : [],
    });
  }
  return out;
}

/** Slim + filter status-change events; newest first. */
export function pruneChangelog(changelog, { since = null, limit = null } = {}) {
  const events = Array.isArray(changelog?.data?.certprocessstatuschangelog)
    ? changelog.data.certprocessstatuschangelog
    : [];
  let out = events
    .map((e, i) =>
      e === null || typeof e !== 'object'
        ? null
        : {
            date: dateOrNull(e.transition_date),
            csp: cleanStr(e.csp),
            cso: cleanStr(e.cso),
            type: cleanStr(e.cert_type, 64),
            path: cleanStr(e.cert_path, 64),
            class: cleanStr(e.cert_class, 64),
            from: cleanStr(e.from_status),
            to: cleanStr(e.to_status),
            idx: i,
          },
    )
    .filter((e) => e && e.date && e.to)
    .sort((a, b) => cmpStr(b.date, a.date) || a.idx - b.idx) // newest first; ties keep feed order
    .map(({ idx, ...e }) => e);
  if (since) out = out.filter((e) => e.date >= since);
  if (limit) out = out.slice(0, limit);
  return out;
}
