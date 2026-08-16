#!/usr/bin/env node
/**
 * Verify every external URL cited by the site returns HTTP 200.
 * Coverage: the citation registry (docs/js/sources.js), the feed endpoints
 * (docs/js/feeds.js), every absolute href in every docs/*.html page, and the
 * marketplace product-link base that services.js emits. Exits non-zero if
 * anything is unreachable — fedramp.gov was restructured in June 2026, so
 * this guards against rot.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONCURRENCY = 6;

const { SOURCES } = await import(pathToFileURL(path.join(ROOT, 'docs/js/sources.js')));
const { resolveFeedRevisions } = await import(pathToFileURL(path.join(ROOT, 'docs/js/feeds.js')));

const urls = new Set();

// 1. Citation registry.
for (const s of Object.values(SOURCES)) urls.add(s.url);

// 2. Exact immutable feed endpoints (both mirrors) and their home repos.
const resolvedFeeds = await resolveFeedRevisions();
for (const feed of Object.values(resolvedFeeds)) {
  for (const u of feed.urls) urls.add(u);
  urls.add(feed.home);
}

// 3. Every absolute href in every docs/*.html page (double or single quotes).
const pages = (await readdir(path.join(ROOT, 'docs'))).filter((f) => f.endsWith('.html'));
for (const page of pages) {
  const html = await readFile(path.join(ROOT, 'docs', page), 'utf8');
  for (const m of html.matchAll(/href=(?:"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)')/g)) {
    urls.add(m[1] ?? m[2]);
  }
}

// 4. The hardcoded product-link base emitted by docs/js/views/services.js,
//    probed with a known-good id (AWS GovCloud).
urls.add('https://marketplace.fedramp.gov/products/F1607067912');

/** HEAD first (cheap); fall back to GET when HEAD is rejected or errors. */
async function check(url) {
  let last;
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'Mozilla/5.0 (link-check; +https://github.com/laynr/FedRAMP)' },
      });
      if (res.ok) return { url, status: res.status, ok: true };
      last = { url, status: res.status, ok: false };
    } catch (err) {
      last = { url, status: `ERR ${err.message}`, ok: false };
    }
  }
  return last;
}

/** Simple worker pool: at most CONCURRENCY requests in flight. */
async function checkAll(list) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        results[i] = await check(list[i]);
      }
    })
  );
  return results;
}

const results = await checkAll([...urls]);
let bad = 0;
for (const r of [...results].sort((a, b) => String(a.status).localeCompare(String(b.status)))) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? ' ok ' : 'FAIL'} ${r.status}  ${r.url}`);
}
console.log(`\n${results.length - bad}/${results.length} links OK (${pages.length} pages scanned: ${pages.join(', ')})`);
process.exitCode = bad ? 1 : 0;
