/** Official feed identities and immutable-revision resolution, browser-safe. */

import { fetchJSONResource } from './fetch-json.js';

export const FEEDS = {
  marketplace: {
    repo: 'FedRAMP/marketplace-fedramp-gov-data',
    ref: 'main',
    file: 'data.json',
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  changelog: {
    repo: 'FedRAMP/marketplace-fedramp-gov-data',
    ref: 'main',
    file: 'fedramp-status-changelog.json',
    home: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  rules: {
    repo: 'FedRAMP/rules',
    ref: 'main',
    file: 'fedramp-consolidated-rules.json',
    home: 'https://github.com/FedRAMP/rules',
  },
};

/** Shared fetch hygiene limits: reject oversized responses, bound every request. */
export const FETCH_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  timeoutMs: 30_000,
};

export const REVISION_LIMITS = { maxBytes: 1024 * 1024, timeoutMs: 15_000 };
export const COMMIT_RE = /^[0-9a-f]{40}$/;

export function immutableFeedUrls(feed, commit) {
  if (!COMMIT_RE.test(commit)) throw new Error(`invalid commit SHA: ${commit}`);
  return [
    `https://cdn.jsdelivr.net/gh/${feed.repo}@${commit}/${feed.file}`,
    `https://raw.githubusercontent.com/${feed.repo}/${commit}/${feed.file}`,
  ];
}

const revisionPromises = new Map();

async function resolveRepository(repo, ref, fetchResource) {
  const key = `${repo}@${ref}`;
  if (!revisionPromises.has(key)) {
    revisionPromises.set(key, (async () => {
      const url = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`;
      const { data } = await fetchResource(url, {
        ...REVISION_LIMITS,
        headers: { accept: 'application/vnd.github+json' },
      });
      const commit = data?.sha;
      if (!COMMIT_RE.test(commit)) throw new Error(`GitHub returned no valid commit for ${key}`);
      const commitDate = typeof data?.commit?.committer?.date === 'string' ? data.commit.committer.date : null;
      return { commit, commitDate };
    })());
  }
  try {
    return await revisionPromises.get(key);
  } catch (error) {
    revisionPromises.delete(key);
    throw error;
  }
}

async function resolveFileBlob(feed, commit, fetchResource) {
  const filePath = feed.file.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${feed.repo}/contents/${filePath}?ref=${commit}`;
  const { data } = await fetchResource(url, {
    ...REVISION_LIMITS,
    headers: { accept: 'application/vnd.github+json' },
  });
  const blobSha = data?.sha;
  if (!COMMIT_RE.test(blobSha) || data?.type !== 'file') {
    throw new Error(`GitHub returned no valid blob identity for ${feed.repo}/${feed.file}@${commit}`);
  }
  return blobSha;
}

/** Resolve mutable branch names once, then return immutable URLs for every feed. */
export async function resolveFeedRevisions(
  names = Object.keys(FEEDS),
  { fetchResource = fetchJSONResource, force = false } = {},
) {
  const selected = names.map((name) => {
    const feed = FEEDS[name];
    if (!feed) throw new Error(`unknown feed: ${name}`);
    if (force) revisionPromises.delete(`${feed.repo}@${feed.ref}`);
    return [name, feed];
  });
  const repositories = new Map();
  for (const [, feed] of selected) repositories.set(`${feed.repo}@${feed.ref}`, feed);
  const resolved = new Map(await Promise.all([...repositories].map(async ([key, feed]) => [
    key,
    await resolveRepository(feed.repo, feed.ref, fetchResource),
  ])));

  const withBlobs = await Promise.all(selected.map(async ([name, feed]) => {
    const revision = resolved.get(`${feed.repo}@${feed.ref}`);
    const blobSha = await resolveFileBlob(feed, revision.commit, fetchResource);
    return [name, { ...feed, ...revision, blobSha, urls: immutableFeedUrls(feed, revision.commit) }];
  }));
  return Object.fromEntries(withBlobs);
}

export function resetFeedRevisionCache() {
  revisionPromises.clear();
}
