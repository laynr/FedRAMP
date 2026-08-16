/** Bounded, digested JSON retrieval shared by browser live mode and the CLI. */

const JSON_TYPES = /(json|octet-stream|text\/plain)/i;

export async function readBoundedBytes(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`response too large (${declared} bytes declared; limit ${maxBytes})`);
  }

  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error(`response too large (${bytes.byteLength} bytes; limit ${maxBytes})`);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel('response exceeded size limit'); } catch { /* preserve the size-limit error */ }
        throw new Error(`response too large (more than ${maxBytes} bytes)`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function digestHex(algorithm, bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto digests are unavailable in this runtime');
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export const sha256Hex = (bytes) => digestHex('SHA-256', bytes);

/** Git object identity: SHA-1("blob " + byteLength + NUL + raw bytes). */
export async function gitBlobSha1(bytes) {
  const prefix = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const object = new Uint8Array(prefix.byteLength + bytes.byteLength);
  object.set(prefix);
  object.set(bytes, prefix.byteLength);
  return digestHex('SHA-1', object);
}

export function assertGitBlobIdentity(actual, expected, label = 'resource') {
  if (actual !== expected) {
    throw new Error(`Git blob mismatch for ${label}: expected ${expected}, received ${actual}`);
  }
}

export async function fetchJSONResource(
  url,
  { maxBytes, timeoutMs, fetchImpl = globalThis.fetch, headers = {} } = {},
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('maxBytes must be a positive integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive integer');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable in this runtime');

  let response;
  try {
    response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(`request failed for ${url}: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`${response.status}${response.statusText ? ` ${response.statusText}` : ''} for ${url}`);
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType && !JSON_TYPES.test(contentType)) throw new Error(`unexpected content-type "${contentType}" for ${url}`);

  let body;
  try {
    body = await readBoundedBytes(response, maxBytes);
  } catch (error) {
    throw new Error(`${error.message} for ${url}`, { cause: error });
  }
  let text;
  let data;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid UTF-8 JSON from ${url}: ${error.message}`, { cause: error });
  }
  return {
    data,
    text,
    bytes: body.byteLength,
    sha256: await sha256Hex(body),
    gitBlobSha1: await gitBlobSha1(body),
    contentType,
  };
}
