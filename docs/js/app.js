/**
 * App shell: tabs (real history entries + a11y tab semantics), theme,
 * dialog-grade drawers (focus trap + restore), countdowns, boot.
 * Every view render is individually guarded — one broken view shows an
 * inline error panel instead of killing the whole page.
 */

import { loadSnapshot, onStateChange, state } from './data.js';
import { wireCitations } from './sources.js';
import { initKsi } from './ksi.js';
import { renderPulse } from './views/pulse.js';
import { renderServices, openServiceDrawer } from './views/services.js';
import { renderDuration } from './views/duration.js';
import { renderAgencies } from './views/agencies.js';
import { openDrawer, closeDrawers, storage } from './ui.js';

// ---------- theme (stored value is untrusted — accept only known themes) ----------
const savedTheme = storage.get('theme');
if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = () => document.documentElement.dataset.theme ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
// Screen readers get a label that says what the button will DO, kept in sync.
const labelThemeToggle = () =>
  themeToggle.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
labelThemeToggle();
themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  storage.set('theme', next);
  labelThemeToggle();
});

// ---------- tabs / routing ----------
const tabs = [...document.querySelectorAll('.tab')];
const views = Object.fromEntries(tabs.map((t) => [t.dataset.view, document.getElementById(`view-${t.dataset.view}`)]));
const tablist = document.querySelector('nav.tabs');

// ARIA tab semantics, applied from JS (index.html belongs to the markup pass).
tablist?.setAttribute('role', 'tablist');
for (const t of tabs) {
  t.setAttribute('role', 'tab');
  if (!t.id) t.id = `tab-${t.dataset.view}`;
  t.setAttribute('aria-controls', `view-${t.dataset.view}`);
}
for (const [n, el] of Object.entries(views)) {
  el.setAttribute('role', 'tabpanel');
  el.setAttribute('aria-labelledby', `tab-${n}`);
  el.setAttribute('tabindex', '0'); // tabs pattern: Tab moves from the tablist into the panel
}

let activeView = 'pulse';

function showView(name, { push = false } = {}) {
  if (!views[name]) name = 'pulse';
  activeView = name;
  for (const t of tabs) {
    const on = t.dataset.view === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1; // roving tabindex per the tabs pattern
  }
  for (const [n, el] of Object.entries(views)) {
    el.hidden = n !== name;
    // Re-trigger the entry fade: the animation lives on .view-enter (site.css)
    // so toggling `hidden` alone can't replay it.
    el.classList.remove('view-enter');
  }
  void views[name].offsetWidth; // reflow so the class re-add restarts the animation
  views[name].classList.add('view-enter');
  const target = `#${name}`;
  if (location.hash !== target) {
    // User navigation gets a real history entry; normalization only replaces.
    history[push ? 'pushState' : 'replaceState'](null, '', target);
  }
}

/** Route a hash. `#services=<id>` deep-links a service profile. Returns the id (or null). */
const DEEPLINK = /^#services=([A-Za-z0-9._-]{1,64})$/;
function route(hash, { push = false } = {}) {
  const m = DEEPLINK.exec(hash ?? '');
  showView(m ? 'services' : (hash || '#pulse').slice(1), { push });
  return m ? m[1] : null;
}

for (const t of tabs) t.addEventListener('click', () => showView(t.dataset.view, { push: true }));
tablist?.addEventListener('keydown', (e) => {
  const idx = tabs.indexOf(document.activeElement);
  if (idx < 0) return;
  let next = null;
  if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  if (next == null) return;
  e.preventDefault();
  tabs[next].focus();
  showView(tabs[next].dataset.view, { push: true });
});
addEventListener('popstate', () => {
  const id = route(location.hash);
  if (id && state.productsById.has(id)) openServiceDrawer(id);
  else closeAll({ restoreHash: false }); // hash already reflects history
});

// ---------- drawers as dialogs (focus trap, restore, hash cleanup) ----------
const backdrop = document.getElementById('drawer-backdrop');
const explainer = document.getElementById('explainer');
const svcDrawer = document.getElementById('svc-drawer');

let dialogOpener = null;

function onDialogOpen(el) {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && ae !== document.body && !el.contains(ae)) dialogOpener = ae;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  const target = el.querySelector('.close-btn') ?? el.querySelector('h2');
  if (target) {
    if (!(target instanceof HTMLButtonElement) && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  }
}
// services.js announces its drawer opening; the explainer opens right here.
document.addEventListener('fedramp:drawer-open', (e) => onDialogOpen(e.detail.drawer));
document.getElementById('open-explainer').addEventListener('click', () => {
  openDrawer(explainer);
  onDialogOpen(explainer);
});

function closeAll({ restoreHash = true } = {}) {
  const wasOpen = [explainer, svcDrawer].some((el) => el && !el.hidden);
  closeDrawers();
  if (!wasOpen) return;
  if (restoreHash && DEEPLINK.test(location.hash)) history.replaceState(null, '', `#${activeView}`);
  if (dialogOpener && document.contains(dialogOpener)) dialogOpener.focus();
  dialogOpener = null;
}

backdrop.addEventListener('click', () => closeAll());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeAll();
});

// Simple focus trap: Tab cycles within whichever drawer is open.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const open = [svcDrawer, explainer].find((el) => el && !el.hidden && el.classList.contains('open'));
  if (!open) return;
  const focusables = [...open.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const inside = open.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
});

// ---------- countdowns (client-side; age gracefully; refresh on tab return) ----------
function renderCountdowns() {
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
}
renderCountdowns();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderCountdowns(); // a tab left open overnight stays correct
});

// ---------- per-view guarded rendering ----------
let ksiReady = false;
function renderKsi() {
  if (ksiReady) return;
  const totalInd = state.ksi.families.reduce((a, f) => a + f.indicators.length, 0);
  document.getElementById('ksi-fam-count').textContent = state.ksi.families.length;
  document.getElementById('ksi-ind-count').textContent = totalInd;
  document.getElementById('ksi-version').textContent = state.ksi.version;
  initKsi(document.getElementById('ksi-panel'), state.ksi);
  ksiReady = true;
}

function guardRender(label, viewId, fn) {
  const view = document.getElementById(viewId);
  try {
    fn();
    view?.querySelector(':scope > .render-error')?.remove();
  } catch (err) {
    console.error(`${label} failed to render`, err);
    if (!view) return;
    let panel = view.querySelector(':scope > .render-error');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'panel render-error';
      panel.setAttribute('role', 'alert');
      view.prepend(panel);
    }
    panel.textContent = `${label} hit a rendering error — the rest of the page still works. Details are in the browser console.`;
  }
}

function renderAll() {
  guardRender('Pulse', 'view-pulse', renderPulse);
  guardRender('Services', 'view-services', renderServices);
  guardRender('How long?', 'view-duration', renderDuration);
  guardRender('Agencies', 'view-agencies', renderAgencies);
  guardRender('KSI Quest', 'view-ksi', renderKsi);
}

// ---------- boot ----------
async function boot() {
  const deepId = route(location.hash); // normalizes the hash via replaceState
  onStateChange(renderAll); // fires on snapshot load AND every live refresh
  try {
    await loadSnapshot();
  } catch (err) {
    console.error('snapshot load failed', err);
    document.getElementById('pulse-tiles').innerHTML =
      '<p class="sub">Data failed to load. The tool needs its bundled data files — if you are running locally, serve the docs/ folder over HTTP.</p>';
    return;
  }
  if (deepId && state.productsById.has(deepId)) openServiceDrawer(deepId);
}

wireCitations(document);
boot();
