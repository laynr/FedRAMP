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
