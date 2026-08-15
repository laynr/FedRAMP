/**
 * App shell: tabs, theme, drawers, countdowns, boot.
 */

import { loadSnapshot, state } from './data.js';
import { wireCitations } from './sources.js';
import { initKsi } from './ksi.js';
import { renderPulse } from './views/pulse.js';
import { initServices, openServiceDrawer } from './views/services.js';
import { renderDuration } from './views/duration.js';
import { initAgencies } from './views/agencies.js';
import { openDrawer, closeDrawers } from './ui.js';

// ---------- theme ----------
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
document.getElementById('theme-toggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// ---------- tabs / hash routing ----------
const tabs = [...document.querySelectorAll('.tab')];
const views = Object.fromEntries(tabs.map((t) => [t.dataset.view, document.getElementById(`view-${t.dataset.view}`)]));

export function showView(name) {
  if (!views[name]) name = 'pulse';
  for (const t of tabs) t.classList.toggle('active', t.dataset.view === name);
  for (const [n, el] of Object.entries(views)) el.hidden = n !== name;
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}
for (const t of tabs) t.addEventListener('click', () => showView(t.dataset.view));
addEventListener('hashchange', () => showView(location.hash.slice(1)));

// ---------- drawers ----------
const backdrop = document.getElementById('drawer-backdrop');
const explainer = document.getElementById('explainer');
const svcDrawer = document.getElementById('svc-drawer');

backdrop.addEventListener('click', closeDrawers);
addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawers());
document.getElementById('open-explainer').addEventListener('click', () => openDrawer(explainer));
document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closeDrawers();
});

// ---------- countdowns (client-side; age gracefully) ----------
const daysUntil = (iso) => Math.ceil((new Date(`${iso}T00:00:00`) - Date.now()) / 86_400_000);
for (const el of document.querySelectorAll('[data-deadline]')) {
  const d = daysUntil(el.dataset.deadline);
  el.textContent =
    d > 1 ? `${el.dataset.what} in ${d} days` :
    d === 1 ? `${el.dataset.what} tomorrow` :
    d === 0 ? `${el.dataset.what} today` :
    `${el.dataset.after} ${-d} days ago`;
  el.classList.toggle('past', d < 0);
}

// ---------- boot ----------
async function boot() {
  showView(location.hash.slice(1) || 'pulse');
  try {
    await loadSnapshot();
  } catch (err) {
    console.error('snapshot load failed', err);
    document.getElementById('pulse-tiles').innerHTML =
      '<p class="sub">Data failed to load. The tool needs its bundled data files — if you are running locally, serve the docs/ folder over HTTP.</p>';
    return;
  }

  renderPulse();
  initServices();
  renderDuration();
  initAgencies();

  const totalInd = state.ksi.families.reduce((a, f) => a + f.indicators.length, 0);
  document.getElementById('ksi-fam-count').textContent = state.ksi.families.length;
  document.getElementById('ksi-ind-count').textContent = totalInd;
  document.getElementById('ksi-version').textContent = state.ksi.version;
  initKsi(document.getElementById('ksi-panel'), state.ksi);
}

wireCitations(document);
export { openServiceDrawer };
boot();
