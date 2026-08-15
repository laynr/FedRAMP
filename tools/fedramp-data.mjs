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
import {
  slimProducts, computeStats, pruneKsi, pruneChangelog,
  buildJourneys, journeyStats, buildActivity, slimAgencies,
} from '../docs/js/transforms.js';

export { slimProducts, computeStats, pruneKsi, pruneChangelog, buildJourneys, journeyStats, buildActivity, slimAgencies };

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
    case 'journeys': {
      const cl = await fetchSource('changelog');
      const built = buildJourneys(cl);
      const stats = journeyStats(built);
      if (flags.fastest) {
        for (const f of stats.fastest) console.log(`${String(f.days).padStart(4)} days  ${f.is20x ? '[20x] ' : '      '}${f.cso} [${f.csp}]  finished ${f.end}`);
      } else {
        console.log(JSON.stringify({ ...stats, fastest: undefined, histogram: undefined }, null, 2));
      }
      break;
    }
    case 'snapshot': {
      const [mkt, cl, rules] = await Promise.all([
        fetchSource('marketplace'),
        fetchSource('changelog'),
        fetchSource('rules'),
      ]);
      await mkdir(OUT_DIR, { recursive: true });
      const built = buildJourneys(cl);
      const bundles = {
        'products.json': slimProducts(mkt),
        'stats.json': { ...computeStats(mkt), journeys: journeyStats(built) },
        'ksi.json': pruneKsi(rules),
        'journeys.json': built.journeys,
        'agencies.json': slimAgencies(mkt),
        'activity.json': buildActivity(mkt, cl),
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
