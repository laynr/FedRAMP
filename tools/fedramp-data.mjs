#!/usr/bin/env node
/**
 * fedramp-data — zero-dependency CLI for official FedRAMP machine-readable data.
 *
 * Sources (all official, published by GSA/FedRAMP on GitHub, CORS-open):
 *   marketplace  github.com/FedRAMP/marketplace-fedramp-gov-data  data.json
 *   changelog    github.com/FedRAMP/marketplace-fedramp-gov-data  fedramp-status-changelog.json
 *   rules        github.com/FedRAMP/rules                         fedramp-consolidated-rules.json
 *
 * Feed URLs live in docs/js/feeds.js — one registry shared with the browser.
 *
 * Commands:
 *   fetch [--force]                    download sources to .cache/ (6h freshness window)
 *   products [--status S] [--impact I] [--search Q] [--limit N] [--json]
 *   ksi [FAMILY]                       list KSI families, or indicators of one family
 *   changelog [--since YYYY-MM-DD] [--limit N] [--json]
 *   journeys [--fastest]               authorization-journey stats from the changelog
 *   stats                              computed program statistics
 *   snapshot                           write pruned site bundles to docs/data/
 */

import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FEEDS, FETCH_LIMITS } from '../docs/js/feeds.js';
import {
  slimProducts, computeStats, pruneKsi, pruneChangelog,
  buildJourneys, journeyStats, buildActivity, slimAgencies,
} from '../docs/js/transforms.js';

export { slimProducts, computeStats, pruneKsi, pruneChangelog, buildJourneys, journeyStats, buildActivity, slimAgencies };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const OUT_DIR = path.join(ROOT, 'docs', 'data');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Cache-file names are a CLI concern; URLs come from the shared registry.
const CACHE_FILES = { marketplace: 'marketplace.json', changelog: 'changelog.json', rules: 'rules.json' };

export const SOURCES = Object.fromEntries(
  Object.entries(FEEDS).map(([name, feed]) => [name, { file: CACHE_FILES[name], ...feed }])
);

const USAGE = `usage: fedramp-data.mjs <command> [flags]

commands:
  fetch [--force]                    download sources to .cache/ (6h freshness window)
  products [--status S] [--impact I] [--search Q] [--limit N] [--json]
  ksi [FAMILY]                       list KSI families, or indicators of one family
  changelog [--since YYYY-MM-DD] [--limit N] [--json]
  journeys [--fastest]               authorization-journey stats from the changelog
  stats                              computed program statistics
  snapshot                           write pruned site bundles to docs/data/
  --help, -h                         show this message`;

// ---------- fs helpers ----------

/** Write via a temp file + rename so a crash can never leave a torn file. */
async function writeFileAtomic(file, text) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, file);
}

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
    try {
      return JSON.parse(await readFile(cached, 'utf8'));
    } catch {
      // corrupt or unreadable cache — fall through to the network
    }
  }
  let lastErr;
  for (const url of src.urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      const len = Number(res.headers.get('content-length'));
      if (Number.isFinite(len) && len > FETCH_LIMITS.maxBytes) {
        throw new Error(`response too large (${len} bytes > ${FETCH_LIMITS.maxBytes}) for ${url}`);
      }
      const text = await res.text();
      if (Buffer.byteLength(text) > FETCH_LIMITS.maxBytes) {
        throw new Error(`response too large (${Buffer.byteLength(text)} bytes > ${FETCH_LIMITS.maxBytes}) for ${url}`);
      }
      const data = JSON.parse(text);
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFileAtomic(cached, text);
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

// ---------- snapshot integrity ----------

/**
 * Defense against a poisoned upstream landing in the repo: after the
 * transforms run, the serialized bundles must contain no script fragments,
 * javascript: URLs, or control characters (raw, or JSON-escaped except
 * \n \r \t). The transforms sanitize on the way in; this is the backstop.
 */
export function scanSnapshotText(file, text) {
  const problems = [];
  if (/<script/i.test(text)) problems.push('contains "<script"');
  if (/javascript:/i.test(text)) problems.push('contains "javascript:"');
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) problems.push('contains raw control characters');
  if (/\\u00(?:0[0-9a-f]|1[0-9a-f])/i.test(text)) problems.push('contains escaped control characters');
  return problems.map((p) => `${file}: ${p}`);
}

/** Newest of the upstream timestamps — keeps meta.json stable when nothing changed. */
export function latestUpstreamISO(candidates) {
  let max = null;
  for (const c of candidates) {
    const t = Date.parse(c);
    if (Number.isFinite(t) && (max === null || t > max)) max = t;
  }
  return max === null ? null : new Date(max).toISOString();
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

/** Read a numeric flag with a clear error instead of NaN surprises. */
export function num(flags, name, { def, min } = {}) {
  const raw = flags[name];
  if (raw === undefined) return def;
  if (raw === true || !/^-?\d+$/.test(String(raw))) {
    throw new Error(`--${name} expects a whole number (got ${raw === true ? 'nothing' : `"${raw}"`})`);
  }
  const n = Number(raw);
  if (min !== undefined && n < min) throw new Error(`--${name} must be >= ${min} (got ${n})`);
  return n;
}

/** Validate a --since value as a real ISO calendar date. */
export function isoDate(flags, name) {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  if (raw === true || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
    throw new Error(`--${name} expects an ISO date (YYYY-MM-DD), got ${raw === true ? 'nothing' : `"${raw}"`}`);
  }
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    throw new Error(`--${name} is not a valid calendar date: "${raw}"`);
  }
  return raw;
}

const monthsAgoISO = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);

  if (cmd === undefined || cmd === '--help' || cmd === '-h') {
    console.log(USAGE);
    return;
  }

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
      const limit = num(flags, 'limit', { def: 25, min: 1 });
      const mkt = await fetchSource('marketplace');
      let list = slimProducts(mkt);
      if (flags.status) list = list.filter((p) => p.status?.toLowerCase().includes(String(flags.status).toLowerCase()));
      if (flags.impact) list = list.filter((p) => p.impact?.toLowerCase() === String(flags.impact).toLowerCase());
      if (flags.search) {
        const q = String(flags.search).toLowerCase();
        list = list.filter((p) => [p.csp, p.cso, p.offering].some((s) => s?.toLowerCase().includes(q)));
      }
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
      const since = isoDate(flags, 'since') ?? monthsAgoISO(3);
      const limit = num(flags, 'limit', { def: 30, min: 1 });
      const cl = await fetchSource('changelog');
      const events = pruneChangelog(cl, { since, limit });
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
          // Derived from upstream timestamps (not wall clock) so an unchanged
          // upstream produces a byte-identical snapshot — no eternal diffs.
          generated: latestUpstreamISO([
            mkt?.meta?.last_change,
            cl?.metadata?.export_timestamp,
            rules?.info?.last_updated,
          ]),
          sources: {
            marketplace: { home: SOURCES.marketplace.home, lastChange: mkt?.meta?.last_change },
            changelog: { home: SOURCES.changelog.home, exported: cl?.metadata?.export_timestamp },
            rules: { home: SOURCES.rules.home, version: rules?.info?.version, updated: rules?.info?.last_updated },
          },
        },
      };
      // Serialize everything first; write nothing until every bundle passes
      // the integrity scan — a poisoned upstream must not land in the repo.
      const serialized = Object.entries(bundles).map(([file, data]) => [file, JSON.stringify(data)]);
      const problems = serialized.flatMap(([file, text]) => scanSnapshotText(file, text));
      if (problems.length) {
        throw new Error(`snapshot integrity check failed — nothing written:\n  ${problems.join('\n  ')}`);
      }
      await mkdir(OUT_DIR, { recursive: true });
      let total = 0;
      for (const [file, text] of serialized) {
        total += text.length;
        await writeFileAtomic(path.join(OUT_DIR, file), text);
        console.log(`docs/data/${file.padEnd(16)} ${String(Math.round(text.length / 1024)).padStart(5)} KB`);
      }
      console.log(`total ${Math.round(total / 1024)} KB`);
      break;
    }
    default:
      console.error(`unknown command: ${cmd}\n\n${USAGE}`);
      process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  });
}
