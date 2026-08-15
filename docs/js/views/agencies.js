/** Agencies view: who's adopting what across the government. */

import { state } from '../data.js';
import { esc, fmt } from '../ui.js';
import { openServiceDrawer } from './services.js';

export function initAgencies() {
  const root = document.getElementById('view-agencies');
  const search = root.querySelector('#ag-search');
  const list = root.querySelector('#ag-list');
  const detail = root.querySelector('#ag-detail');
  let activeId = null;

  const sorted = [...state.agencies].sort((a, b) => b.authorizations + b.reuse - (a.authorizations + a.reuse));

  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = sorted.filter((a) => !q || a.name.toLowerCase().includes(q)).slice(0, 40);
    list.innerHTML = rows.map((a) => `
      <button class="ag-row ${a.id === activeId ? 'active' : ''}" data-ag="${esc(a.id)}">
        <span class="ag-name">${esc(a.name)}</span>
        <span class="ag-counts">${fmt(a.authorizations)} auth · ${fmt(a.reuse)} reuse</span>
      </button>`).join('');
  }

  function show(id) {
    activeId = id;
    const a = state.agencies.find((x) => x.id === id);
    if (!a) return;
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

  search.addEventListener('input', draw);
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ag]');
    if (btn) show(btn.dataset.ag);
  });
  detail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (btn) openServiceDrawer(btn.dataset.open);
  });
  draw();
}
