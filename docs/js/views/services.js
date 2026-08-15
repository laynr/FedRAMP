/** Services view: instant search + filters + star buttons + profile drawer. */

import { state, relativeDate } from '../data.js';
import { openDrawer } from '../ui.js';
import { esc, fmt } from '../ui.js';
import { loadWatchlist, saveWatchlist, toggleStar, refreshFingerprints } from '../watchlist.js';

let watch = loadWatchlist();
const listeners = new Set();

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
    btn.textContent = isStarred(id) ? '★' : '☆';
  }
}

/** Persist current fingerprints for all starred ids (called after diff on boot). */
export function commitFingerprints() {
  watch = refreshFingerprints(watch, state.productsById, state.journeysById);
  saveWatchlist(watch);
}

const starBtn = (id) =>
  `<button class="star ${isStarred(id) ? 'starred' : ''}" data-star="${esc(id)}" aria-label="Watch this service" title="Watch: next visit starts with what changed">${isStarred(id) ? '★' : '☆'}</button>`;

// ---------- list ----------

export function initServices() {
  const root = document.getElementById('view-services');
  const search = root.querySelector('#svc-search');
  const statusSel = root.querySelector('#svc-status');
  const impactSel = root.querySelector('#svc-impact');
  const starredOnly = root.querySelector('#svc-starred');
  const list = root.querySelector('#svc-list');
  const countEl = root.querySelector('#svc-count');
  const moreBtn = root.querySelector('#svc-more');
  let shown = 30;

  const uniq = (key) => [...new Set(state.products.map((p) => p[key]).filter(Boolean))].sort();
  statusSel.innerHTML = '<option value="">Any status</option>' + uniq('status').map((v) => `<option>${esc(v)}</option>`).join('');
  impactSel.innerHTML = '<option value="">Any impact level</option>' + uniq('impact').map((v) => `<option>${esc(v)}</option>`).join('');

  function matches() {
    const q = search.value.trim().toLowerCase();
    return state.products
      .filter((p) => !statusSel.value || p.status === statusSel.value)
      .filter((p) => !impactSel.value || p.impact === impactSel.value)
      .filter((p) => !starredOnly.checked || isStarred(p.id))
      .filter((p) => !q || [p.csp, p.cso, p.offering, p.assessor].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => b.reuse - a.reuse);
  }

  function draw() {
    const rows = matches();
    list.innerHTML = rows.slice(0, shown).map((p) => `
      <div class="svc-row" data-open="${esc(p.id)}">
        ${starBtn(p.id)}
        <div class="svc-name"><strong>${esc(p.cso)}</strong><span>${esc(p.csp)}</span></div>
        <span class="pill ${p.impact?.startsWith('20x') ? 'pill-20x' : ''}">${esc(p.impact ?? '—')}</span>
        <span class="pill">${esc(p.status ?? '—')}</span>
        <span class="svc-reuse" title="reuses">${fmt(p.reuse)}↻</span>
      </div>`).join('');
    countEl.textContent = `${Math.min(shown, rows.length)} of ${fmt(rows.length)} services — click one for its story`;
    moreBtn.style.display = rows.length > shown ? '' : 'none';
  }

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
          <span class="tl-date">${e.date}</span>
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
        <h2>${esc(p.cso)}</h2>
        <p class="sub">${esc(p.csp)}</p>
      </div>
      ${starBtn(p.id)}
      <button class="close-btn" data-close aria-label="Close">✕</button>
    </div>
    <div class="chips">
      <span class="pill ${p.impact?.startsWith('20x') ? 'pill-20x' : ''}">${esc(p.impact ?? '—')}</span>
      <span class="pill">${esc(p.status ?? '—')}</span>
      ${p.authType ? `<span class="pill">${esc(p.authType)} path</span>` : ''}
      ${p.authDate ? `<span class="pill">authorized ${p.authDate} (${relativeDate(p.authDate)})</span>` : ''}
    </div>
    <h3>The journey</h3>
    ${timeline}
    <h3>Who uses it</h3>
    <p class="sub"><strong>${fmt(p.reuse)}</strong> reuses on record${atoUsers.length ? ` · ${fmt(atoUsers.length)} direct authorization${atoUsers.length === 1 ? '' : 's'}` : ''}</p>
    ${reuseUsers.length ? userList(reuseUsers) : atoUsers.length ? userList(atoUsers) : '<p class="sub">No agency mappings published for this service yet.</p>'}
    <h3>Details</h3>
    <table class="kv">
      ${p.assessor ? `<tr><td>Assessor (3PAO)</td><td>${esc(p.assessor)}</td></tr>` : ''}
      ${p.deployment ? `<tr><td>Deployment</td><td>${esc(p.deployment)}</td></tr>` : ''}
      ${p.models?.length ? `<tr><td>Service model</td><td>${esc(p.models.join(', '))}</td></tr>` : ''}
      <tr><td>Official listing</td><td><a href="https://marketplace.fedramp.gov/products/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">marketplace.fedramp.gov ↗</a></td></tr>
    </table>`;

  drawer.querySelector('[data-star]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    star(id);
  });
  openDrawer(drawer);
}
