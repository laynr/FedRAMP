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
