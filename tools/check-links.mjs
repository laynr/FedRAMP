#!/usr/bin/env node
/**
 * Verify every external URL cited by the site returns HTTP 200.
 * Sources: the citation registry (docs/js/sources.js) plus any absolute
 * links in docs/index.html. Exits non-zero if anything is unreachable —
 * fedramp.gov was restructured in June 2026, so this guards against rot.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SOURCES } = await import(path.join(ROOT, 'docs/js/sources.js'));

const urls = new Set(Object.values(SOURCES).map((s) => s.url));
const html = await readFile(path.join(ROOT, 'docs/index.html'), 'utf8');
for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) urls.add(m[1]);

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'Mozilla/5.0 (link-check; +https://github.com/laynr/FedRAMP)' },
      });
      if (res.ok) return { url, status: res.status };
      if (method === 'GET') return { url, status: res.status };
    } catch (err) {
      if (method === 'GET') return { url, status: `ERR ${err.message}` };
    }
  }
}

const results = await Promise.all([...urls].map(check));
let bad = 0;
for (const r of results.sort((a, b) => String(a.status).localeCompare(String(b.status)))) {
  const ok = r.status === 200;
  if (!ok) bad++;
  console.log(`${ok ? ' ok ' : 'FAIL'} ${r.status}  ${r.url}`);
}
console.log(`\n${results.length - bad}/${results.length} links OK`);
process.exitCode = bad ? 1 : 0;
