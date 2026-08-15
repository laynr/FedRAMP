/**
 * Pure transforms over the official FedRAMP feeds.
 * Shared by the browser (docs/js/*) and the Node CLI (tools/fedramp-data.mjs),
 * so the site's "live refresh" and the build-time snapshots can never disagree.
 * Feed shapes verified against the real data 2026-08-15; see docs/data/README.md.
 */

const dateOrNull = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/** Slim the 43-field marketplace product records down to what the site uses. */
export function slimProducts(marketplace) {
  const products = marketplace?.data?.Products ?? [];
  return products.map((p) => ({
    id: p.id,
    csp: p.csp ?? null,
    cso: p.cso ?? null,
    offering: p.service_offering ?? null,
    status: p.status ?? null,
    impact: p.impact_level ?? null,
    authType: p.auth_type && p.auth_type !== 'Not Active' ? p.auth_type : null,
    authDate: dateOrNull(p.auth_date),
    reuse: typeof p.reuse === 'number' ? p.reuse : 0,
    assessor: p.independent_assessor && p.independent_assessor !== 'Not Active' ? p.independent_assessor : null,
    models: Array.isArray(p.service_model) ? p.service_model : [],
    deployment: p.deployment_model ?? null,
    agencies: Array.isArray(p.agency_authorizations) ? p.agency_authorizations.length : 0,
  }));
}

const count = (arr, key) => {
  const out = {};
  for (const item of arr) {
    const k = key(item);
    if (k == null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

export const is20x = (p) => typeof p.impact === 'string' && p.impact.startsWith('20x');

/** Program-level statistics computed from the full marketplace feed. */
export function computeStats(marketplace) {
  const slim = slimProducts(marketplace);
  const authorized = slim.filter((p) => p.status === 'FedRAMP Authorized');
  return {
    lastChange: marketplace?.meta?.last_change ?? null,
    totals: {
      products: slim.length,
      byStatus: count(slim, (p) => p.status),
      byImpact: count(slim, (p) => p.impact),
      authorized20x: authorized.filter(is20x).length,
    },
    authsByYear: count(authorized, (p) => p.authDate?.slice(0, 4)),
    authsByYear20x: count(authorized.filter(is20x), (p) => p.authDate?.slice(0, 4)),
    topReused: [...authorized]
      .sort((a, b) => b.reuse - a.reuse)
      .slice(0, 15)
      .map((p) => ({ cso: p.cso, csp: p.csp, reuse: p.reuse, impact: p.impact })),
    topAssessors: Object.entries(count(authorized, (p) => p.assessor))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, n]) => ({ name, count: n })),
  };
}

/** Prune the consolidated rules file to the KSI catalog the site renders. */
export function pruneKsi(rules) {
  const families = Object.values(rules?.KSI ?? {}).map((fam) => ({
    id: fam.id,
    name: fam.name,
    short: fam.short_name,
    status: fam.status,
    indicators: Object.entries(fam.indicators ?? {}).map(([id, ind]) => ({
      id,
      name: ind.name,
      statement: ind.statement,
      controls: ind.controls ?? [],
      // per-class statement overrides, when FedRAMP varies an indicator by class
      classes: ind.varies_by_class ?? null,
    })),
  }));
  return {
    version: rules?.info?.version ?? null,
    updated: rules?.info?.last_updated ?? null,
    families,
  };
}

/* ======================= journey engine =======================
 * The status changelog is messy real-world event data: migration-era backfill
 * (source:"migration", coarse dates), out-of-order rows, duplicate transitions,
 * journeys missing a start or an end, and a mixed vocabulary of 15 statuses.
 * Invariants enforced here:
 *   1. events are sorted by (transition_date, recorded_date), ascending
 *   2. consecutive duplicates (same date + same to_status) collapse to one
 *   3. an "end" is the FIRST event matching END_STATUS; the "start" is the
 *      first event before it that is neither an end nor a delisting
 *   4. duration (days) exists only when start < end; everything else is
 *      excluded and COUNTED, never silently dropped
 *   5. migration-sourced journeys are flagged (their early dates are coarser)
 * Vocabulary verified against the live feed 2026-08-15.
 */

const END_STATUS = /^(authorized$|fedramp certified)/i; // Authorized, FedRAMP Certified, FedRAMP Certified (In Remediation)
const DELISTED = /no status found/i;

/** Build per-product journeys from the raw changelog. Returns {journeys, excluded}. */
export function buildJourneys(changelog) {
  const rows = changelog?.data?.certprocessstatuschangelog ?? [];
  const byProduct = new Map();
  for (const r of rows) {
    const date = dateOrNull(r.transition_date);
    if (!date || !r.to_status || !r.product_id) continue;
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, { csp: null, cso: null, evs: [] });
    const g = byProduct.get(r.product_id);
    if (!g.cso && (r.cso || r.csp)) {
      g.cso = r.cso || null;
      g.csp = r.csp || null;
    }
    g.evs.push({
      date,
      to: r.to_status,
      class: r.cert_class || null,
      path: r.cert_path || null,
      type: r.cert_type || null,
      source: r.source || null,
      recorded: r.recorded_date || '',
    });
  }

  const journeys = [];
  const excluded = { delistedOnly: 0, noEnd: 0, noStart: 0, invalidOrder: 0 };

  for (const [id, group] of byProduct) {
    const evs = group.evs;
    evs.sort((a, b) => (a.date === b.date ? (a.recorded < b.recorded ? -1 : 1) : a.date < b.date ? -1 : 1));
    const deduped = evs.filter((e, i) => i === 0 || !(e.date === evs[i - 1].date && e.to === evs[i - 1].to));

    const is20x = deduped.some((e) => e.type === '20x' || e.path === '20x' || e.path === 'Program');
    const migration = deduped.some((e) => e.source === 'migration');
    const live = deduped.filter((e) => !DELISTED.test(e.to));
    if (!live.length) {
      excluded.delistedOnly++;
      continue;
    }

    const endIdx = live.findIndex((e) => END_STATUS.test(e.to));
    const start = endIdx === -1 ? live.find((e) => !END_STATUS.test(e.to)) : live.slice(0, endIdx).find((e) => !END_STATUS.test(e.to));
    const end = endIdx === -1 ? null : live[endIdx];

    let days = null;
    if (!end) excluded.noEnd++;
    else if (!start) excluded.noStart++; // e.g. migration backfill starting at "Authorized"
    else if (end.date <= start.date) excluded.invalidOrder++;
    else days = Math.round((new Date(end.date) - new Date(start.date)) / 86_400_000);

    journeys.push({
      id,
      csp: group.csp,
      cso: group.cso,
      is20x,
      migration,
      days,
      start: days != null ? start.date : null,
      end: days != null ? end.date : null,
      current: live[live.length - 1].to,
      events: deduped.map((e) => ({ date: e.date, to: e.to, class: e.class })),
    });
  }
  return { journeys, excluded };
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];

/** Duration statistics over measured journeys, split legacy vs 20x-path. */
export function journeyStats({ journeys, excluded }) {
  const measured = journeys.filter((j) => j.days != null);
  const split = (list) => {
    const days = list.map((j) => j.days).sort((a, b) => a - b);
    if (!days.length) return { n: 0, p10: null, p50: null, p90: null };
    return { n: days.length, p10: percentile(days, 10), p50: percentile(days, 50), p90: percentile(days, 90) };
  };
  const BIN = 90;
  const MAXBIN = 12; // last bin is open-ended: 990+ days
  const histogram = Array.from({ length: MAXBIN }, (_, i) => ({
    label: i === MAXBIN - 1 ? `${i * BIN}+` : `${i * BIN}–${(i + 1) * BIN}`,
    count: 0,
  }));
  for (const j of measured) {
    histogram[Math.min(MAXBIN - 1, Math.floor(j.days / BIN))].count++;
  }
  return {
    totalWithEvents: journeys.length,
    measured: measured.length,
    excluded,
    all: split(measured),
    path20x: split(measured.filter((j) => j.is20x)),
    legacy: split(measured.filter((j) => !j.is20x)),
    cleanOnly: split(measured.filter((j) => !j.migration)),
    histogram,
    fastest: [...measured]
      .filter((j) => j.end && j.end >= '2025-01-01')
      .sort((a, b) => a.days - b.days)
      .slice(0, 12)
      .map((j) => ({ id: j.id, cso: j.cso, csp: j.csp, days: j.days, end: j.end, is20x: j.is20x })),
  };
}

/** Merged live-activity feed: status transitions + dated agency reuses/ATOs. */
export function buildActivity(marketplace, changelog, { limit = 120 } = {}) {
  const products = new Map((marketplace?.data?.Products ?? []).map((p) => [p.id, p]));
  const out = [];
  for (const e of pruneChangelog(changelog)) {
    out.push({ date: e.date, kind: 'status', to: e.to, class: e.class, cso: e.cso, csp: e.csp });
  }
  for (const r of marketplace?.data?.ReuseMapping ?? []) {
    const date = dateOrNull(r.auth_date) ?? dateOrNull(r.ato_date);
    const p = products.get(r.id);
    if (!date || !p) continue;
    const agency = r.sub ? `${r.parent} — ${r.sub}` : r.parent;
    out.push({ date, kind: 'reuse', agency, cso: p.cso ?? p.service_offering, csp: p.csp });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

/** Slim agency directory; product references are ids, resolved client-side. */
export function slimAgencies(marketplace) {
  return (marketplace?.data?.Agencies ?? []).map((a) => ({
    id: a.id,
    name: a.sub ? `${a.parent} — ${a.sub}` : a.parent,
    authorizations: a.authorization ?? 0,
    reuse: a.reuse ?? 0,
    auths: (a.auths ?? []).map((x) => x.id),
    reuses: (a.reuses ?? []).map((x) => x.id),
  }));
}

/** Slim + filter status-change events; newest first. */
export function pruneChangelog(changelog, { since = null, limit = null } = {}) {
  const events = changelog?.data?.certprocessstatuschangelog ?? [];
  let out = events
    .map((e) => ({
      date: dateOrNull(e.transition_date),
      csp: e.csp || null,
      cso: e.cso || null,
      type: e.cert_type || null,
      path: e.cert_path || null,
      class: e.cert_class || null,
      from: e.from_status || null,
      to: e.to_status || null,
    }))
    .filter((e) => e.date && e.to)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (since) out = out.filter((e) => e.date >= since);
  if (limit) out = out.slice(0, limit);
  return out;
}
