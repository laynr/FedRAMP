import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchJSONResource, assertGitBlobIdentity } from '../docs/js/fetch-json.js';
import { resolveFeedRevisions, resetFeedRevisionCache } from '../docs/js/feeds.js';

const jsonResponse = (value, headers = {}) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'content-type': 'application/json', ...headers },
});

test('fetchJSONResource streams within the byte limit and records a SHA-256 digest', async () => {
  const result = await fetchJSONResource('https://example.test/data.json', {
    maxBytes: 1024,
    timeoutMs: 1000,
    fetchImpl: async () => jsonResponse({ ok: true }),
  });

  assert.deepEqual(result.data, { ok: true });
  assert.equal(result.bytes, 11);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.match(result.gitBlobSha1, /^[0-9a-f]{40}$/);
  assert.doesNotThrow(() => assertGitBlobIdentity(result.gitBlobSha1, result.gitBlobSha1, 'fixture'));
  assert.throws(() => assertGitBlobIdentity(result.gitBlobSha1, '0'.repeat(40), 'fixture'), /Git blob mismatch/);
});

test('fetchJSONResource rejects oversized streamed bodies before parsing', async () => {
  await assert.rejects(
    fetchJSONResource('https://example.test/large.json', {
      maxBytes: 8,
      timeoutMs: 1000,
      fetchImpl: async () => jsonResponse({ payload: 'too large' }),
    }),
    /response too large/,
  );
});

test('fetchJSONResource rejects non-JSON content types', async () => {
  await assert.rejects(
    fetchJSONResource('https://example.test/page', {
      maxBytes: 1024,
      timeoutMs: 1000,
      fetchImpl: async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    }),
    /unexpected content-type/,
  );
});

test('feed resolution deduplicates repositories and produces immutable URLs', async () => {
  resetFeedRevisionCache();
  let commitCalls = 0;
  let blobCalls = 0;
  const marketplaceCommit = 'a'.repeat(40);
  const rulesCommit = 'b'.repeat(40);
  const blobs = {
    'data.json': 'c'.repeat(40),
    'fedramp-status-changelog.json': 'd'.repeat(40),
    'fedramp-consolidated-rules.json': 'e'.repeat(40),
  };
  const fetchResource = async (url) => {
    if (url.includes('/contents/')) {
      blobCalls++;
      const [file] = Object.keys(blobs).filter((candidate) => url.includes(candidate));
      return { data: { type: 'file', sha: blobs[file] } };
    }
    commitCalls++;
    return {
      data: {
        sha: url.includes('/FedRAMP/rules/') ? rulesCommit : marketplaceCommit,
        commit: { committer: { date: '2026-08-15T00:00:00Z' } },
      },
    };
  };

  const feeds = await resolveFeedRevisions(['marketplace', 'changelog', 'rules'], { fetchResource });
  assert.equal(commitCalls, 2);
  assert.equal(blobCalls, 3);
  assert.equal(feeds.marketplace.commit, marketplaceCommit);
  assert.equal(feeds.changelog.commit, marketplaceCommit);
  assert.equal(feeds.rules.commit, rulesCommit);
  assert.equal(feeds.marketplace.blobSha, blobs['data.json']);
  assert.equal(feeds.changelog.blobSha, blobs['fedramp-status-changelog.json']);
  assert.equal(feeds.rules.blobSha, blobs['fedramp-consolidated-rules.json']);
  for (const feed of Object.values(feeds)) {
    assert.equal(feed.urls.length, 2);
    assert.ok(feed.urls.every((url) => url.includes(feed.commit)));
    assert.ok(feed.urls.every((url) => !url.includes('@main') && !url.includes('/main/')));
  }
});

test('feed resolution fails closed on an invalid revision', async () => {
  resetFeedRevisionCache();
  await assert.rejects(
    resolveFeedRevisions(['rules'], { fetchResource: async () => ({ data: { sha: 'main' } }) }),
    /no valid commit/,
  );
});

test('feed resolution fails closed when the file is not anchored to a Git blob', async () => {
  resetFeedRevisionCache();
  await assert.rejects(
    resolveFeedRevisions(['rules'], {
      fetchResource: async (url) => url.includes('/contents/')
        ? { data: { type: 'file', sha: 'not-a-blob' } }
        : { data: { sha: 'a'.repeat(40), commit: { committer: { date: '2026-08-15T00:00:00Z' } } } },
    }),
    /no valid blob identity/,
  );
});
