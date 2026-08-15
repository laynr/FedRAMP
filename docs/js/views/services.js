/**
 * Services view: instant search + filters + star buttons + profile drawer.
 * renderServices() is idempotent — the app calls it on every state swap
 * (snapshot load AND live refresh); listeners are wired exactly once.
 *
 * A11y contract with the markup/CSS pass:
 *   <div class="svc-item">            flex row (Agent L styles)
 *     <button class="star">…</button> star is a SIBLING, never nested
 *     <button class="svc-row">…</button>  keeps its grid minus the star column
 *   </div>
 */

import { state, relativeDate } from '../data.js';
import { openDrawer, esc, fmt } from '../ui.js';
import {
  loadWatchlist, saveWatchlist, toggleStar, refreshFingerprints,
  markVisited as advanceVisit, SAFE_ID,
} from '../watchlist.js';

let watch = loadWatchlist();
const listeners = new Set();
let wired = false;
let shown = 30;

/** Other views can react to star changes (e.g. Pulse watch card). */
export function onWatchChange(fn) {
  listeners.add(fn);
}
export function getWatchlist() {
  return watch;
}
export function isStarred(id) {
  return watch.starred.includes(id);
}

export function star(id) {
  watch = refreshFingerprints(toggleStar(watch, id), state.productsById, state.journeysById);
  saveWatchlist(watch);
  for (const fn of listeners) fn(watch);
  // repaint any star buttons for this id
  for (const btn of document.querySelectorAll(`[data-star="${CSS.escape(id)}"]`)) {
    btn.classList.toggle('starred', isStarred(id));
    btn.innerHTML = `<span aria-hidden="true">${isStarred(id) ? '★' : '☆'}</span>`;
    btn.setAttribute('aria-pressed', String(isStarred(id)));
    btn.setAttribute('aria-label', starLabel(id));
  }
}

/** Persist current fingerprints for all starred ids (does NOT advance savedAt). */
export function commitFingerprints() {
  watch = refreshFingerprints(watch, state.productsById, state.journeysById);
  saveWatchlist(watch);
}

/** Advance "last visit" once per page load (Pulse calls this after diffs render). */
export function markVisited() {
  watch = advanceVisit(watch);
}

// Every star gets a name with CONTEXT — 50 rows of "Watch this service" is
// useless in a screen reader's buttons list.
const starLabel = (id) => {
  const name = state.productsById.get(id)?.cso ?? 'this service';
  return isStarred(id) ? `Stop watching ${name}` : `Watch ${name}`;
};

const starBtn = (id) =>
  `<button class="star ${isStarred(id) ? 'starred' : ''}" data-star="${esc(id)}" aria-pressed="${isStarred(id)}" aria-label="${esc(starLabel(id))}" title="Watch: next visit starts with what changed"><span aria-hidden="true">${isStarred(id) ? '★' : '☆'}</span></button>`;

// ---------- list ----------

const els = () => ({
  search: document.getElementById('svc-search'),
  statusSel: document.getElementById('svc-status'),
  impactSel: document.getElementById('svc-impact'),
  starredOnly: document.getElementById('svc-starred'),
  list: document.getElementById('svc-list'),
  countEl: document.getElementById('svc-count'),
  moreBtn: document.getElementById('svc-more'),
});

function rebuildFilters() {
  const { search, statusSel, impactSel } = els();
  const uniq = (key) => [...new Set(state.products.map((p) => p[key]).filter(Boolean))].sort();
  for (const [sel, key, anyLabel] of [
    [statusSel, 'status', 'Any status'],
    [impactSel, 'impact', 'Any impact level'],
  ]) {
    const prev = sel.value;
    sel.innerHTML = `<option value="">${anyLabel}</option>` + uniq(key).map((v) => `<option>${esc(v)}</option>`).join('');
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }
  search.placeholder = `Search ${fmt(state.products.length)} services, providers, assessors…`;
}

function matches() {
  const { search, statusSel, impactSel, starredOnly } = els();
  const q = search.value.trim().toLowerCase();
  return state.products
    .filter((p) => !statusSel.value || p.status === statusSel.value)
    .filter((p) => !impactSel.value || p.impact === impactSel.value)
    .filter((p) => !starredOnly.checked || isStarred(p.id))
    .filter((p) => !q || [p.csp, p.cso, p.offering, p.assessor].some((s) => s?.toLowerCase().includes(q)))
    .sort((a, b) => b.reuse - a.reuse);
}

function draw() {
  const { list, countEl, moreBtn } = els();
  const rows = matches();
  if (!rows.length) {
    list.innerHTML = `<div class="panel svc-empty">
      <p class="sub">No services match these filters.</p>
      <button class="ghost-btn" data-clear-filters>Clear search &amp; filters</button>
    </div>`;
    countEl.textContent = 'No matches — try clearing the filters';
    moreBtn.style.display = 'none';
    return;
  }
  list.innerHTML = rows.slice(0, shown).map((p) => `
    <div class="svc-item">
      ${starBtn(p.id)}
      <button class="svc-row" data-open="${esc(p.id)}">
        <span class="svc-name"><strong>${esc(p.cso)}</strong><span>${esc(p.csp)}</span></span>
        <span class="pill ${p.impact?.startsWith('20x') ? 'pill-20x' : ''}">${esc(p.impact ?? '—')}</span>
        <span class="pill">${esc(p.status ?? '—')}</span>
        <span class="svc-reuse" title="reuses">${fmt(p.reuse)}<span class="visually-hidden"> reuses</span><span aria-hidden="true">↻</span></span>
      </button>
    </div>`).join('');
  countEl.textContent = `${Math.min(shown, rows.length)} of ${fmt(rows.length)} services — click one for its story`;
  moreBtn.style.display = rows.length > shown ? '' : 'none';
}

function wire() {
  const { search, statusSel, impactSel, starredOnly, list, moreBtn } = els();
  for (const ctl of [search, statusSel, impactSel, starredOnly]) {
    ctl.addEventListener('input', () => {
      shown = 30;
      draw();
    });
  }
  moreBtn.addEventListener('click', () => {
    shown += 60;
    draw();
  });
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-filters]')) {
      search.value = '';
      statusSel.value = '';
      impactSel.value = '';
      starredOnly.checked = false;
      shown = 30;
      draw();
      return;
    }
    const sb = e.target.closest('[data-star]');
    if (sb) {
      star(sb.dataset.star);
      if (starredOnly.checked) draw();
      return;
    }
    const row = e.target.closest('[data-open]');
    if (row) openServiceDrawer(row.dataset.open);
  });
  onWatchChange(() => starredOnly.checked && draw());
}

/** Idempotent: wires once, then rebuilds filters/placeholder and redraws. */
export function renderServices() {
  if (!wired) {
    wired = true;
    wire();
  }
  rebuildFilters();
  draw();
}

// ---------- profile drawer ----------

export function openServiceDrawer(id) {
  const p = state.productsById.get(id);
  if (!p) return;
  const j = state.journeysById.get(id);
  const users = state.usersByProduct.get(id) ?? [];
  const drawer = document.getElementById('svc-drawer');

  const timeline = j?.events?.length
    ? `<ol class="timeline">${j.events.map((e, i) => `
        <li class="${i === j.events.length - 1 ? 'tl-now' : ''}">
          <span class="tl-date">${esc(e.date)}</span>
          <span class="tl-status">${esc(e.to)}${e.class ? ` <span class="pill">${esc(e.class)}</span>` : ''}</span>
        </li>`).join('')}</ol>
      ${j.days != null ? `<p class="sub">Journey: <strong>${fmt(j.days)} days</strong> from first in-process event to ${esc(j.events.find((e) => /certified|authorized/i.test(e.to))?.to ?? 'done')}${j.migration ? ' · includes migration-era records (coarser dates)' : ''}</p>` : ''}`
    : '<p class="sub">No status-change events in FedRAMP’s published changelog for this service (the log mainly covers recent activity and migrated records).</p>';

  const atoUsers = users.filter((u) => u.kind === 'ato');
  const reuseUsers = users.filter((u) => u.kind === 'reuse');
  const userList = (arr) => {
    const names = arr.map((u) => u.agency);
    const head = names.slice(0, 10).map((n) => `<li>${esc(n)}</li>`).join('');
    const more = names.length > 10 ? `<li class="sub">…and ${names.length - 10} more</li>` : '';
    return `<ul class="agency-list">${head}${more}</ul>`;
  };

  drawer.innerHTML = `
    <div class="drawer-head">
      <div>
        <h2 id="svc-drawer-title">${esc(p.cso)}</h2>
        <p class="sub">${esc(p.csp)}</p>
      </div>
      ${starBtn(p.id)}
      <button class="close-btn" data-close aria-label="Close">✕</button>
    </div>
    <div class="chips">
      <span class="pill ${p.impact?.startsWith('20x') ? 'pill-20x' : ''}">${esc(p.impact ?? '—')}</span>
      <span class="pill">${esc(p.status ?? '—')}</span>
      ${p.authType ? `<span class="pill">${esc(p.authType)} path</span>` : ''}
      ${p.authDate ? `<span class="pill">authorized ${esc(p.authDate)} (${relativeDate(p.authDate)})</span>` : ''}
    </div>
    <h3>The journey</h3>
    ${timeline}
    <h3>Who uses it</h3>
    <p class="sub"><strong>${fmt(p.reuse)}</strong> reuses on record${atoUsers.length ? ` · ${fmt(atoUsers.length)} direct authorization${atoUsers.length === 1 ? '' : 's'}` : ''}</p>
    ${reuseUsers.length ? userList(reuseUsers) : atoUsers.length ? userList(atoUsers) : '<p class="sub">No agency mappings published for this service yet.</p>'}
    <h3>Details</h3>
    <table class="kv">
      <caption class="visually-hidden">Service details</caption>
      ${p.assessor ? `<tr><th scope="row">Assessor (3PAO)</th><td>${esc(p.assessor)}</td></tr>` : ''}
      ${p.deployment ? `<tr><th scope="row">Deployment</th><td>${esc(p.deployment)}</td></tr>` : ''}
      ${p.models?.length ? `<tr><th scope="row">Service model</th><td>${esc(p.models.join(', '))}</td></tr>` : ''}
      <tr><th scope="row">Official listing</th><td><a href="https://marketplace.fedramp.gov/products/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">marketplace.fedramp.gov <span aria-hidden="true">↗</span><span class="visually-hidden">(opens in a new tab)</span></a></td></tr>
    </table>`;

  // The dialog's accessible name is the service name (the injected <h2>).
  drawer.setAttribute('aria-labelledby', 'svc-drawer-title');
  drawer.removeAttribute('aria-label');
  drawer.querySelector('[data-star]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    star(id);
  });
  openDrawer(drawer);
  // Deep link: reloading (or sharing) the URL reopens this profile.
  if (SAFE_ID.test(id)) history.replaceState(null, '', `#services=${encodeURIComponent(id)}`);
  // app.js owns dialog a11y (focus, trap, restore) — announce the open.
  document.dispatchEvent(new CustomEvent('fedramp:drawer-open', { detail: { drawer } }));
}
