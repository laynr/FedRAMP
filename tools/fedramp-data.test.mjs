import test from 'node:test';
import assert from 'node:assert/strict';
import { slimProducts, computeStats, pruneKsi, pruneChangelog, fetchSource } from './fedramp-data.mjs';

// ---------- fixtures (shapes match the real feeds, verified 2026-08-15) ----------

const marketplace = {
  meta: { last_change: '2026-08-15T02:27:33.800Z', produced_by: 'General Services Administration' },
  data: {
    Products: [
      {
        id: 'F001', csp: 'Acme', cso: 'Acme Cloud', service_offering: 'Acme Cloud',
        status: 'FedRAMP Authorized', impact_level: 'Moderate', auth_type: 'Agency',
        auth_date: '2024-11-19T20:00:00.000Z', reuse: 25, independent_assessor: 'Assessor A',
        service_model: ['SaaS'], deployment_model: 'Public Cloud',
        agency_authorizations: ['Dept X', 'Dept Y'], service_desc: 'A very long description we must drop',
      },
      {
        id: 'F002', csp: 'Beta', cso: 'Beta Gov', service_offering: 'Beta Gov',
        status: 'FedRAMP Authorized', impact_level: '20x Low', auth_type: 'Program',
        auth_date: '2025-07-15T20:00:00.000Z', reuse: 3, independent_assessor: 'Assessor B',
        service_model: ['SaaS'], deployment_model: 'Public Cloud', agency_authorizations: [],
      },
      {
        id: 'F003', csp: 'Gamma', cso: 'Gamma Suite', service_offering: 'Gamma Suite',
        status: 'FedRAMP In Process', impact_level: 'High', auth_type: 'Not Active',
        auth_date: 'Not Active', reuse: 0, independent_assessor: 'Not Active',
        service_model: [], deployment_model: 'Government Community Cloud', agency_authorizations: [],
      },
    ],
  },
};

const changelog = {
  metadata: { export_timestamp: '2026-08-15T19:59:32.489Z', total_entries: 3 },
  data: {
    certprocessstatuschangelog: [
      { csp: 'Old Co', cso: 'Old CSO', cert_type: 'Rev5', cert_path: 'JAB', cert_class: 'Class C', from_status: '', to_status: 'JAB Review', transition_date: '2012-07-19T04:00:00.000Z' },
      { csp: 'New Co', cso: 'New CSO', cert_type: '', cert_path: 'Program', cert_class: 'Class B', from_status: 'Initial', to_status: 'Certified', transition_date: '2026-08-14T20:55:23Z' },
      { csp: 'Mid Co', cso: 'Mid CSO', cert_type: 'Rev5', cert_path: 'Agency', cert_class: '', from_status: '', to_status: 'In Process', transition_date: '2026-01-05T00:00:00Z' },
      { csp: 'Bad Co', cso: 'Bad CSO', cert_type: '', cert_path: '', cert_class: '', from_status: '', to_status: '', transition_date: 'garbage' },
    ],
  },
};

const rules = {
  info: { version: '2026.07.14.01', last_updated: '2026-07-14' },
  KSI: {
    CED: {
      id: 'KSI-CED', name: 'Cybersecurity Education', short_name: 'CED', status: 'stable',
      indicators: {
        'KSI-CED-RAT': {
          name: 'Reviewing All Training',
          statement: 'Training effectiveness is persistently reviewed.',
          controls: ['at-2', 'ir-2'],
          updated: [{ date: '2026-06-24', comment: 'launch' }],
        },
        'KSI-CED-VBC': {
          name: 'Varies By Class',
          statement: 'Base statement.',
          controls: [],
          varies_by_class: { b: { statement: 'Class B variant.' }, c: { statement: 'Class C variant.' } },
        },
      },
    },
  },
};

// ---------- slimProducts ----------

test('slimProducts keeps only site fields and normalizes sentinels', () => {
  const slim = slimProducts(marketplace);
  assert.equal(slim.length, 3);
  assert.deepEqual(slim[0], {
    id: 'F001', csp: 'Acme', cso: 'Acme Cloud', offering: 'Acme Cloud',
    status: 'FedRAMP Authorized', impact: 'Moderate', authType: 'Agency',
    authDate: '2024-11-19', reuse: 25, assessor: 'Assessor A',
    models: ['SaaS'], deployment: 'Public Cloud', agencies: 2,
  });
  // "Not Active" sentinels become null; agencies collapses to a count
  assert.equal(slim[2].authType, null);
  assert.equal(slim[2].authDate, null);
  assert.equal(slim[2].assessor, null);
  // heavy fields are gone
  assert.ok(!('service_desc' in slim[0]));
  assert.ok(!('logo' in slim[0]));
});

test('slimProducts tolerates missing data', () => {
  assert.deepEqual(slimProducts({}), []);
  assert.deepEqual(slimProducts(undefined), []);
});

// ---------- computeStats ----------

test('computeStats counts statuses, impacts, years, 20x and rankings', () => {
  const s = computeStats(marketplace);
  assert.equal(s.lastChange, '2026-08-15T02:27:33.800Z');
  assert.equal(s.totals.products, 3);
  assert.equal(s.totals.byStatus['FedRAMP Authorized'], 2);
  assert.equal(s.totals.byStatus['FedRAMP In Process'], 1);
  assert.equal(s.totals.byImpact['20x Low'], 1);
  assert.equal(s.totals.authorized20x, 1);
  assert.deepEqual(s.authsByYear, { 2024: 1, 2025: 1 });
  assert.equal(s.topReused[0].cso, 'Acme Cloud');
  assert.equal(s.topAssessors.length, 2);
});

// ---------- pruneKsi ----------

test('pruneKsi flattens families and preserves per-class variations', () => {
  const k = pruneKsi(rules);
  assert.equal(k.version, '2026.07.14.01');
  assert.equal(k.families.length, 1);
  const fam = k.families[0];
  assert.equal(fam.id, 'KSI-CED');
  assert.equal(fam.indicators.length, 2);
  const plain = fam.indicators.find((i) => i.id === 'KSI-CED-RAT');
  assert.equal(plain.classes, null);
  assert.deepEqual(plain.controls, ['at-2', 'ir-2']);
  const varied = fam.indicators.find((i) => i.id === 'KSI-CED-VBC');
  assert.equal(varied.classes.b.statement, 'Class B variant.');
});

test('pruneKsi tolerates missing data', () => {
  assert.deepEqual(pruneKsi({}).families, []);
});

// ---------- pruneChangelog ----------

test('pruneChangelog slims, drops invalid, sorts newest first, filters and limits', () => {
  const all = pruneChangelog(changelog);
  assert.equal(all.length, 3); // 'garbage' date row dropped
  assert.equal(all[0].csp, 'New Co'); // newest first
  assert.equal(all[0].class, 'Class B');
  assert.equal(all[2].csp, 'Old Co');

  const recent = pruneChangelog(changelog, { since: '2026-01-01' });
  assert.deepEqual(recent.map((e) => e.csp), ['New Co', 'Mid Co']);

  const limited = pruneChangelog(changelog, { limit: 1 });
  assert.equal(limited.length, 1);
});

// ---------- buildJourneys: the messy-data edge cases ----------

import { buildJourneys, journeyStats, buildActivity, slimAgencies } from '../docs/js/transforms.js';
import { fingerprint, diffFingerprints } from '../docs/js/watchlist.js';

const J = (rows) => buildJourneys({ data: { certprocessstatuschangelog: rows } });
const row = (product_id, transition_date, to_status, extra = {}) => ({
  product_id, transition_date, to_status, csp: 'C', cso: 'S', cert_type: '', cert_path: '', cert_class: '', source: 'manual', recorded_date: '2026-01-01', ...extra,
});

test('journeys: happy path measures start→end and keeps event chain', () => {
  const { journeys, excluded } = J([
    row('P1', '2026-01-10T00:00:00Z', 'FedRAMP In Process'),
    row('P1', '2026-03-01T00:00:00Z', 'PMO Review'),
    row('P1', '2026-04-20T00:00:00Z', 'FedRAMP Certified', { cert_type: '20x', cert_path: 'Program' }),
  ]);
  assert.equal(journeys.length, 1);
  const j = journeys[0];
  assert.equal(j.days, 100);
  assert.equal(j.is20x, true);
  assert.equal(j.migration, false);
  assert.equal(j.current, 'FedRAMP Certified');
  assert.equal(j.events.length, 3);
  assert.deepEqual(excluded, { delistedOnly: 0, noEnd: 0, noStart: 0, invalidOrder: 0 });
});

test('journeys: out-of-order rows are sorted; duplicates collapse', () => {
  const { journeys } = J([
    row('P1', '2026-04-20T00:00:00Z', 'Authorized'),
    row('P1', '2026-01-10T00:00:00Z', 'Agency Review'),
    row('P1', '2026-01-10T00:00:00Z', 'Agency Review'), // dup
  ]);
  assert.equal(journeys[0].events.length, 2);
  assert.equal(journeys[0].events[0].to, 'Agency Review');
  assert.equal(journeys[0].days, 100);
});

test('journeys: no end / no start / invalid order are excluded AND counted', () => {
  const { journeys, excluded } = J([
    row('inprog', '2026-01-01T00:00:00Z', 'Agency Review'), // never finishes
    row('backfill', '2020-05-01T00:00:00Z', 'Authorized', { source: 'migration' }), // starts authorized
    row('weird', '2026-02-01T00:00:00Z', 'PMO Review'),
    row('weird', '2026-02-01T00:00:00Z', 'FedRAMP Certified'), // same-day end → not measurable
  ]);
  assert.equal(excluded.noEnd, 1);
  assert.equal(excluded.noStart, 1);
  assert.equal(excluded.invalidOrder, 1);
  assert.ok(journeys.every((j) => j.days === null));
  assert.equal(journeys.find((j) => j.id === 'backfill').migration, true);
});

test('journeys: delisted-only products are dropped; garbage rows ignored', () => {
  const { journeys, excluded } = J([
    row('gone', '2025-01-01T00:00:00Z', 'No Status Found (Delisted)'),
    row('', '2025-01-01T00:00:00Z', 'Authorized'), // no product id
    row('P2', 'not-a-date', 'Authorized'), // bad date
  ]);
  assert.equal(journeys.length, 0);
  assert.equal(excluded.delistedOnly, 1);
});

test('journeyStats: percentiles, histogram binning, path split', () => {
  const rows = [];
  // ten clean legacy journeys of 50,100,...,500 days
  for (let i = 1; i <= 10; i++) {
    rows.push(row(`L${i}`, '2026-01-01T00:00:00Z', 'Agency Review'));
    rows.push(row(`L${i}`, new Date(Date.UTC(2026, 0, 1) + i * 50 * 86_400_000).toISOString(), 'Authorized'));
  }
  rows.push(row('X1', '2026-01-01T00:00:00Z', 'FedRAMP In Process', { cert_type: '20x' }));
  rows.push(row('X1', '2026-01-31T00:00:00Z', 'FedRAMP Certified', { cert_type: '20x' }));
  const stats = journeyStats(J(rows));
  assert.equal(stats.measured, 11);
  assert.equal(stats.path20x.n, 1);
  assert.equal(stats.path20x.p50, 30);
  assert.equal(stats.legacy.n, 10);
  assert.equal(stats.histogram.reduce((a, b) => a + b.count, 0), 11);
  assert.equal(stats.histogram[0].count, 2); // 30 and 50 days land in the 0–90 bin
});

test('activity: merges status + reuse events newest-first; unjoinable reuses dropped', () => {
  const mkt = { data: { Products: [{ id: 'P1', cso: 'Svc', csp: 'Co', service_offering: 'Svc' }], ReuseMapping: [
    { id: 'P1', parent: 'HHS', sub: 'AHRQ', auth_date: '2026-08-12T00:00:00Z' },
    { id: 'NOPE', parent: 'DOE', auth_date: '2026-08-13T00:00:00Z' },
  ] } };
  const act = buildActivity(mkt, { data: { certprocessstatuschangelog: [row('P1', '2026-08-14T00:00:00Z', 'FedRAMP Certified')] } });
  assert.deepEqual(act.map((a) => a.kind), ['status', 'reuse']);
  assert.equal(act[1].agency, 'HHS — AHRQ');
});

test('agencies: slims to id lists', () => {
  const out = slimAgencies({ data: { Agencies: [{ id: 'A1', parent: 'GSA', sub: '', authorization: 2, reuse: 3, auths: [{ id: 'P1', cso: 'x' }], reuses: [{ id: 'P2' }] }] } });
  assert.deepEqual(out[0], { id: 'A1', name: 'GSA', authorizations: 2, reuse: 3, auths: ['P1'], reuses: ['P2'] });
});

// ---------- watchlist diff engine ----------

test('watchlist: fingerprint + diff catches status and journey changes only', () => {
  const saved = {
    A: { status: 'FedRAMP In Process', impact: '20x Moderate', latest: 'PMO Review', latestDate: '2026-07-01' },
    B: { status: 'FedRAMP Authorized', impact: 'High', latest: 'Authorized', latestDate: '2020-01-01' },
    GONE: { status: 'FedRAMP Ready', impact: 'Low', latest: null, latestDate: null },
  };
  const current = {
    A: { status: 'FedRAMP Authorized', impact: '20x Moderate', latest: 'FedRAMP Certified', latestDate: '2026-08-14' },
    B: { status: 'FedRAMP Authorized', impact: 'High', latest: 'Authorized', latestDate: '2020-01-01' },
  };
  const diff = diffFingerprints(saved, current);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].id, 'A');
  assert.deepEqual(diff[0].changes.map((c) => c.field).sort(), ['latest', 'status']);
});

test('watchlist: fingerprint tolerates missing product or journey', () => {
  assert.deepEqual(fingerprint(undefined, undefined), { status: null, impact: null, latest: null, latestDate: null });
  assert.deepEqual(diffFingerprints(null, {}), []);
});

// ---------- live smoke test (opt-in: RUN_LIVE=1 node --test tools/) ----------

test('live: real feeds match expected shapes', { skip: !process.env.RUN_LIVE }, async () => {
  const mkt = await fetchSource('marketplace');
  assert.ok(Array.isArray(mkt.data.Products) && mkt.data.Products.length > 500);
  assert.ok(mkt.meta.last_change);
  const slim = slimProducts(mkt);
  assert.ok(slim.every((p) => p.id && typeof p.reuse === 'number'));

  const r = await fetchSource('rules');
  const k = pruneKsi(r);
  assert.ok(k.families.length >= 10);
  assert.ok(k.families.every((f) => f.indicators.length > 0));

  const cl = await fetchSource('changelog');
  const ev = pruneChangelog(cl, { limit: 10 });
  assert.equal(ev.length, 10);
  assert.ok(ev.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)));
});
