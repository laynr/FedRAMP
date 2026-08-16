import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';

const gitBlobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('#pulse-tiles .tile')).toHaveCount(4);
  await expect(page.locator('.render-error')).toHaveCount(0);
}

function failOnRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

test('primary workflow renders, searches, deep-links, and returns cleanly', async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openApp(page);

  await page.getByRole('tab', { name: 'Services' }).click();
  const search = page.getByRole('searchbox', { name: 'Search services' });
  await search.fill('Slack');
  expect(await page.locator('.svc-row').count()).toBeGreaterThan(0);
  await page.locator('.svc-row').first().click();
  await expect(page.getByRole('dialog', { name: /Slack/i })).toBeVisible();
  await expect(page).toHaveURL(/#services=/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#svc-drawer')).toBeHidden();
  await expect(page).toHaveURL(/#services$/);

  for (const name of ['How long?', 'Agencies', 'KSI Quest', 'Pulse']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.render-error')).toHaveCount(0);
  }
  assertNoErrors();
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every application view stays inside the viewport', async ({ page }) => {
    await openApp(page);
    for (const name of ['Pulse', 'Services', 'How long?', 'Agencies', 'KSI Quest']) {
      await page.getByRole('tab', { name, exact: true }).click();
      const widths = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(widths.document, `${name} widened the ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport + 1);
    }
  });
});

test('rendered Pulse layout keeps its visual hierarchy', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#pulse-tiles')).toHaveCSS('display', 'grid');
  const tileBoxes = await page.locator('#pulse-tiles .tile').evaluateAll((tiles) => tiles.map((tile) => {
    const box = tile.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height), top: Math.round(box.top) };
  }));
  expect(new Set(tileBoxes.map((box) => box.top))).toHaveSize(1);
  expect(Math.max(...tileBoxes.map((box) => box.width)) - Math.min(...tileBoxes.map((box) => box.width))).toBeLessThanOrEqual(2);
  expect(Math.min(...tileBoxes.map((box) => box.height))).toBeGreaterThan(120);
  const chart = page.locator('#chart-years svg');
  await expect(chart).toBeVisible();
  expect((await chart.boundingBox())?.width).toBeGreaterThan(300);
});

for (const [path, ready] of [
  ['/', '#pulse-tiles .tile'],
  ['/learn.html', 'main h1'],
  ['/about.html', 'main h1'],
]) {
  test(`automated accessibility audit: ${path}`, async ({ page }) => {
    const contexts = path === '/' ? ['Pulse', 'Services', 'How long?', 'Agencies', 'KSI Quest'] : [null];
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);
      await expect(page.locator(ready).first()).toBeVisible();
      for (const context of contexts) {
        if (context) await page.getByRole('tab', { name: context, exact: true }).click();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations,
          `${colorScheme}:${context ?? path}\n${results.violations.map((v) => `${v.id}: ${v.help}`).join('\n')}`,
        ).toEqual([]);
      }
      if (path === '/') {
        await page.getByRole('button', { name: 'What is FedRAMP?' }).click();
        const dialogResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          dialogResults.violations,
          `${colorScheme}:Explainer dialog\n${dialogResults.violations.map((v) => `${v.id}: ${v.help}`).join('\n')}`,
        ).toEqual([]);
      }
    }
  });
}

test('live refresh atomically replaces all feeds, including KSI, and exposes provenance', async ({ page }) => {
  const marketCommit = 'a'.repeat(40);
  const rulesCommit = 'b'.repeat(40);
  const marketplace = {
    meta: { last_change: '2026-08-15T20:00:00Z' },
    data: {
      Products: [{
        id: 'LIVE1', csp: 'Live Provider', cso: 'Live Service', service_offering: 'Live Service',
        status: 'FedRAMP Authorized', impact_level: '20x Low', auth_type: 'Program',
        auth_date: '2026-02-01', reuse: 3, agency_authorizations: [], service_model: ['SaaS'],
      }],
      Agencies: [],
      ReuseMapping: [],
    },
  };
  const changelog = {
    metadata: { export_timestamp: '2026-08-15T20:01:00Z' },
    data: { certprocessstatuschangelog: [
      { product_id: 'LIVE1', csp: 'Live Provider', cso: 'Live Service', transition_date: '2026-01-01', to_status: 'FedRAMP In Process', cert_type: '20x' },
      { product_id: 'LIVE1', csp: 'Live Provider', cso: 'Live Service', transition_date: '2026-02-01', to_status: 'FedRAMP Certified', cert_type: '20x' },
    ] },
  };
  const rules = {
    info: { version: 'test-live-v2', last_updated: '2026-08-15' },
    KSI: {
      test: {
        id: 'KSI-TEST', name: 'Live Test Family', short_name: 'TEST', status: 'stable',
        indicators: {
          'KSI-TEST-1': { name: 'Live indicator', statement: 'The refreshed rule is visible.', controls: ['AC-1'] },
        },
      },
    },
  };
  const bodies = {
    'data.json': JSON.stringify(marketplace),
    'fedramp-status-changelog.json': JSON.stringify(changelog),
    'fedramp-consolidated-rules.json': JSON.stringify(rules),
  };

  await page.route('https://api.github.com/repos/**/commits/main', async (route) => {
    const isRules = route.request().url().includes('/FedRAMP/rules/');
    await route.fulfill({
      json: { sha: isRules ? rulesCommit : marketCommit, commit: { committer: { date: '2026-08-15T20:02:00Z' } } },
    });
  });
  await page.route('https://api.github.com/repos/**/contents/**', async (route) => {
    const [file] = Object.keys(bodies).filter((candidate) => route.request().url().includes(candidate));
    await route.fulfill({ json: { type: 'file', sha: gitBlobSha(bodies[file]) } });
  });
  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    const url = route.request().url();
    const [file] = Object.keys(bodies).filter((candidate) => url.endsWith(`/${candidate}`));
    await route.fulfill({ body: bodies[file], contentType: 'application/json' });
  });

  await openApp(page);
  await page.getByRole('button', { name: 'Fetch live from the GSA-published feed' }).click();
  await expect(page.getByRole('button', { name: /Refreshed from source/ })).toBeVisible();
  await expect(page.locator('#ksi-version')).toHaveText('test-live-v2');
  await expect(page.locator('#ksi-fam-count')).toHaveText('1');
  await expect(page.getByRole('searchbox', { name: 'Search services' })).toHaveAttribute('placeholder', /Search 1 service/);
  await expect(page.locator('#data-provenance')).toContainText(marketCommit.slice(0, 12));
  await expect(page.locator('#data-provenance')).toContainText(rulesCommit.slice(0, 12));
  const sourceLinks = await page.locator('#data-provenance a').evaluateAll((links) => links.map((link) => link.href));
  expect(sourceLinks).toHaveLength(3);
  expect(sourceLinks.every((url) => !url.includes('@main') && !url.includes('/main/'))).toBe(true);
});
