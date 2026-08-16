import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const PAGES = ['docs/index.html', 'docs/learn.html', 'docs/about.html'];
const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

test('every page has a strict CSP with no inline-code concession', async () => {
  for (const file of PAGES) {
    const html = await readFile(file, 'utf8');
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    assert.ok(policy, `${file}: missing CSP`);
    assert.match(policy, /default-src 'none'/, `${file}: default must fail closed`);
    assert.match(policy, /script-src 'self'/, `${file}: scripts must be self-only`);
    assert.match(policy, /style-src 'self'/, `${file}: styles must be self-only`);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/, `${file}: unsafe CSP primitive`);
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${file}: inline style would be blocked`);
  }
});

test('application JavaScript does not mutate inline styles', async () => {
  const files = (await readdir('docs/js', { recursive: true }))
    .filter((file) => file.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(`docs/js/${file}`, 'utf8');
    assert.doesNotMatch(source, /\.style\s*\.|setAttribute\(\s*['"]style|\sstyle\s*=/, `${file}: inline-style mutation`);
  }
});

test('bundled snapshot records immutable, content-anchored source provenance', async () => {
  const meta = JSON.parse(await readFile('docs/data/meta.json', 'utf8'));
  for (const name of ['marketplace', 'changelog', 'rules']) {
    const source = meta.sources?.[name];
    assert.match(source?.commit ?? '', SHA1, `${name}: commit`);
    assert.match(source?.blobSha ?? '', SHA1, `${name}: blob`);
    assert.match(source?.sha256 ?? '', SHA256, `${name}: SHA-256`);
    assert.ok(source.url.includes(source.commit), `${name}: URL is not pinned to its commit`);
    assert.ok(!source.url.includes('@main') && !source.url.includes('/main/'), `${name}: mutable URL`);
  }
});
