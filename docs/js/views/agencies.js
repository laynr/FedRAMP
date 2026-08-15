/**
 * Agencies view: who's adopting what across the government.
 * renderAgencies() is idempotent — the app calls it on every state swap; the
 * sorted list is computed INSIDE draw so a live refresh can never render a
 * stale captured array. Listeners are wired exactly once.
 */

import { state } from '../data.js';
import { esc, fmt } from '../ui.js';
import { openServiceDrawer } from './services.js';

const PAGE = 40;

let wired = false;
let activeId = null;
let shown = PAGE;

const els = () => ({
  search: document.getElementById('ag-search'),
  list: document.getElementById('ag-list'),
  detail: document.getElementById('ag-detail'),
});

function sortedAgencies() {
  return [...state.agencies].sort((a, b) => b.authorizations + b.reuse - (a.authorizations + a.reuse));
}

function draw() {
  const { search, list } = els();
  const q = search.value.trim().toLowerCase();
  const matched = sortedAgencies().filter((a) => !q || a.name.toLowerCase().includes(q));
  const rows = matched.slice(0, shown);
  const footer = matched.length > rows.length
    ? `<div class="ag-more">
        <p class="sub">Showing ${fmt(rows.length)} of ${fmt(matched.length)} agencies — search to find more.</p>
        <button class="ghost-btn" data-more>Show more</button>
      </div>`
    : '';
  list.innerHTML = rows.map((a) => `
    <button class="ag-row ${a.id === activeId ? 'active' : ''}" data-ag="${esc(a.id)}">
      <span class="ag-name">${esc(a.name)}</span>
      <span class="ag-counts">${fmt(a.authorizations)} auth · ${fmt(a.reuse)} reuse</span>
    </button>`).join('') + footer;
}

function show(id) {
  const { detail } = els();
  const a = state.agencies.find((x) => x.id === id);
  if (!a) {
    // e.g. the agency vanished after a live refresh — reset rather than strand stale detail
    activeId = null;
    detail.innerHTML = '<p class="sub">Pick an agency to see what it authorizes and reuses.</p>';
    draw();
    return;
  }
  activeId = id;
  const resolve = (ids) =>
    ids.map((pid) => state.productsById.get(pid)).filter(Boolean).sort((x, y) => y.reuse - x.reuse);
  const svcList = (items) =>
    items.length
      ? `<div class="svc-mini-list">${items.map((p) => `
          <button class="svc-mini" data-open="${esc(p.id)}">
            <strong>${esc(p.cso)}</strong><span>${esc(p.csp)} · ${esc(p.impact ?? '—')}</span>
          </button>`).join('')}</div>`
      : '<p class="sub">None on record.</p>';
  detail.innerHTML = `
    <h3>${esc(a.name)}</h3>
    <p class="sub">${fmt(a.authorizations)} direct authorizations · ${fmt(a.reuse)} reuses of existing authorizations</p>
    <h4>Authorized directly</h4>
    ${svcList(resolve(a.auths))}
    <h4>Reusing</h4>
    ${svcList(resolve(a.reuses).slice(0, 30))}
    ${a.reuses.length > 30 ? `<p class="sub">…and ${fmt(a.reuses.length - 30)} more reused services.</p>` : ''}`;
  draw();
}

function wire() {
  const { search, list, detail } = els();
  search.addEventListener('input', () => {
    shown = PAGE;
    draw();
  });
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) {
      shown += PAGE;
      draw();
      return;
    }
    const btn = e.target.closest('[data-ag]');
    if (btn) show(btn.dataset.ag);
  });
  detail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (btn) openServiceDrawer(btn.dataset.open);
  });
}

/** Idempotent: wires once, refreshes placeholder, redraws list (and detail if open). */
export function renderAgencies() {
  const { search } = els();
  if (!wired) {
    wired = true;
    wire();
  }
  search.placeholder = `Search ${fmt(state.agencies.length)} agencies…`;
  if (activeId) show(activeId); // re-resolves against fresh state; also calls draw()
  else draw();
}
