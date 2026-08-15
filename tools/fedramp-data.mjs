#!/usr/bin/env node
/**
 * fedramp-data — zero-dependency CLI for official FedRAMP machine-readable data.
 *
 * Sources (all official, published by GSA/FedRAMP on GitHub, CORS-open):
 *   marketplace  github.com/FedRAMP/marketplace-fedramp-gov-data  data.json
 *   changelog    github.com/FedRAMP/marketplace-fedramp-gov-data  fedramp-status-changelog.json
 *   rules        github.com/FedRAMP/rules                         fedramp-consolidated-rules.json
 *
 * Commands:
 *   fetch [--force]                    download sources to .cache/ (6h freshness window)
 *   products [--status S] [--impact I] [--search Q] [--limit N] [--json]
 *   ksi [FAMILY]                       list KSI families, or indicators of one family
 *   changelog [--since YYYY-MM-DD] [--limit N] [--json]
 *   stats                              computed program statistics
 *   snapshot                           write pruned site bundles to docs/data/
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const OUT_DIR = path.join(ROOT, 'docs', 'data');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const SOURCES = {
  marketplace: {
    file: 'marketplace.json',
    urls: [
      'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/data.json',
      'https://raw.githubusercontent.com/FedRAMP/marketplace-fedramp-gov-data/main/data.json',
    ],
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  changelog: {
    file: 'changelog.json',
    urls: [
      'https://cdn.jsdelivr.net/gh/FedRAMP/marketplace-fedramp-gov-data@main/fedramp-status-changelog.json',
      'https://raw.githubusercontent.com/FedRAMP/marketplace-fedramp-gov-data/main/fedramp-status-changelog.json',
    ],
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  rules: {
    file: 'rules.json',
    urls: [
      'https://raw.githubusercontent.com/FedRAMP/rules/main/fedramp-consolidated-rules.json',
      'https://cdn.jsdelivr.net/gh/FedRAMP/rules@main/fedramp-consolidated-rules.json',
    ],
    home: 'https://github.com/FedRAMP/rules',
  },
};

// ---------- fetching ----------

async function isFresh(file) {
  try {
    const s = await stat(file);
    return Date.now() - s.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

export async function fetchSource(name, { force = false } = {}) {
  const src = SOURCES[name];
  if (!src) throw new Error(`unknown source: ${name}`);
  const cached = path.join(CACHE_DIR, src.file);
  if (!force && (await isFresh(cached))) {
    return JSON.parse(await readFile(cached, 'utf8'));
  }
  let lastErr;
  for (const url of src.urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      const text = await res.text();
      const data = JSON.parse(text);
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cached, text);
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  // last resort: stale cache beats nothing
  try {
    return JSON.parse(await readFile(cached, 'utf8'));
  } catch {
    throw lastErr;
  }
}

// ---------- pure transforms (unit-tested) ----------

const dateOrNull = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/** Slim the 43-field product records down to what the site uses. */
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

/** Program-level statistics computed from the full marketplace feed. */
export function computeStats(marketplace) {
  const slim = slimProducts(marketplace);
  const authorized = slim.filter((p) => p.status === 'FedRAMP Authorized');
  const authsByYear = count(authorized, (p) => p.authDate?.slice(0, 4));
  const is20x = (p) => typeof p.impact === 'string' && p.impact.startsWith('20x');
  return {
    lastChange: marketplace?.meta?.last_change ?? null,
    totals: {
      products: slim.length,
      byStatus: count(slim, (p) => p.status),
      byImpact: count(slim, (p) => p.impact),
      authorized20x: authorized.filter(is20x).length,
    },
    authsByYear,
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

// ---------- CLI ----------

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const monthsAgoISO = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);

  switch (cmd) {
    case 'fetch': {
      for (const name of Object.keys(SOURCES)) {
        const data = await fetchSource(name, { force: !!flags.force });
        const size = JSON.stringify(data).length;
        console.log(`${name.padEnd(12)} ok  (~${Math.round(size / 1024)} KB cached)`);
      }
      break;
    }
    case 'products': {
      const mkt = await fetchSource('marketplace');
      let list = slimProducts(mkt);
      if (flags.status) list = list.filter((p) => p.status?.toLowerCase().includes(String(flags.status).toLowerCase()));
      if (flags.impact) list = list.filter((p) => p.impact?.toLowerCase() === String(flags.impact).toLowerCase());
      if (flags.search) {
        const q = String(flags.search).toLowerCase();
        list = list.filter((p) => [p.csp, p.cso, p.offering].some((s) => s?.toLowerCase().includes(q)));
      }
      const limit = flags.limit ? Number(flags.limit) : 25;
      const shown = list.slice(0, limit);
      if (flags.json) console.log(JSON.stringify(shown, null, 2));
      else {
        for (const p of shown) console.log(`${(p.status ?? '').padEnd(20)} ${(p.impact ?? '').padEnd(13)} ${String(p.reuse).padStart(4)}↻  ${p.cso}  [${p.csp}]`);
        console.log(`— ${shown.length} of ${list.length} matches (data as of ${mkt?.meta?.last_change})`);
      }
      break;
    }
    case 'ksi': {
      const rules = await fetchSource('rules');
      const ksi = pruneKsi(rules);
      const famArg = positional[0]?.toUpperCase();
      if (!famArg) {
        for (const f of ksi.families) console.log(`${f.id.padEnd(9)} ${String(f.indicators.length).padStart(2)} indicators  ${f.name}`);
        console.log(`— rules version ${ksi.version} (updated ${ksi.updated})`);
      } else {
        const fam = ksi.families.find((f) => f.id === famArg || f.short === famArg || f.id === `KSI-${famArg}`);
        if (!fam) throw new Error(`no KSI family: ${famArg}`);
        for (const ind of fam.indicators) {
          console.log(`\n${ind.id} — ${ind.name}\n  ${ind.statement}\n  controls: ${ind.controls.join(', ') || '(none listed)'}`);
        }
      }
      break;
    }
    case 'changelog': {
      const cl = await fetchSource('changelog');
      const events = pruneChangelog(cl, {
        since: flags.since ?? monthsAgoISO(3),
        limit: flags.limit ? Number(flags.limit) : 30,
      });
      if (flags.json) console.log(JSON.stringify(events, null, 2));
      else for (const e of events) console.log(`${e.date}  ${(e.to ?? '').padEnd(28)} ${(e.class ?? '').padEnd(8)} ${e.cso} [${e.csp}]`);
      break;
    }
    case 'stats': {
      const mkt = await fetchSource('marketplace');
      console.log(JSON.stringify(computeStats(mkt), null, 2));
      break;
    }
    case 'snapshot': {
      const [mkt, cl, rules] = await Promise.all([
        fetchSource('marketplace'),
        fetchSource('changelog'),
        fetchSource('rules'),
      ]);
      await mkdir(OUT_DIR, { recursive: true });
      const bundles = {
        'products.json': slimProducts(mkt),
        'stats.json': computeStats(mkt),
        'ksi.json': pruneKsi(rules),
        'changelog.json': pruneChangelog(cl, { since: monthsAgoISO(18) }),
        'meta.json': {
          generated: new Date().toISOString(),
          sources: {
            marketplace: { home: SOURCES.marketplace.home, lastChange: mkt?.meta?.last_change },
            changelog: { home: SOURCES.changelog.home, exported: cl?.metadata?.export_timestamp },
            rules: { home: SOURCES.rules.home, version: rules?.info?.version, updated: rules?.info?.last_updated },
          },
        },
      };
      let total = 0;
      for (const [file, data] of Object.entries(bundles)) {
        const text = JSON.stringify(data);
        total += text.length;
        await writeFile(path.join(OUT_DIR, file), text);
        console.log(`docs/data/${file.padEnd(16)} ${String(Math.round(text.length / 1024)).padStart(5)} KB`);
      }
      console.log(`total ${Math.round(total / 1024)} KB`);
      break;
    }
    default:
      console.log('usage: fedramp-data.mjs <fetch|products|ksi|changelog|stats|snapshot> [flags]');
      if (cmd) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  });
}
