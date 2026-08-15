/**
 * Marketplace explorer: stat tiles, charts, recent-activity feed, and a
 * searchable table over the official product list.
 */

import { state, refreshLive, freshnessLabel } from './data.js';
import { stackedColumns, barList } from './charts.js';

const fmt = new Intl.NumberFormat('en-US');

export function renderMarket(root) {
  renderTiles(root);
  renderCharts(root);
  renderFeed(root);
  renderTable(root);
  root.querySelector('#data-freshness').textContent = freshnessLabel();
}

function renderTiles(root) {
  const s = state.stats;
  const by = s.totals.byStatus;
  const tiles = [
    { label: 'FedRAMP Authorized services', value: by['FedRAMP Authorized'] ?? 0 },
    { label: 'In process right now', value: (by['FedRAMP In Process'] ?? 0) + (by['Agency In Process'] ?? 0) },
    { label: 'Authorized under 20x', value: s.totals.authorized20x, note: 'impact levels “20x Low/Moderate”' },
    { label: 'Total reuses of the most-reused service', value: s.topReused[0]?.reuse ?? 0, note: s.topReused[0]?.cso },
  ];
  const wrap = root.querySelector('#stat-tiles');
  wrap.innerHTML = '';
  for (const t of tiles) {
    const div = document.createElement('div');
    div.className = 'tile';
    div.innerHTML = `<div class="tile-value">${fmt.format(t.value)}</div><div class="tile-label"></div>${t.note ? '<div class="tile-note"></div>' : ''}`;
    div.querySelector('.tile-label').textContent = t.label;
    if (t.note) div.querySelector('.tile-note').textContent = t.note;
    wrap.appendChild(div);
  }
}

function renderCharts(root) {
  const s = state.stats;
  const years = Object.keys(s.authsByYear).sort();
  const data = years.map((yr) => {
    const total = s.authsByYear[yr] ?? 0;
    const x20 = s.authsByYear20x[yr] ?? 0;
    return { label: `’${yr.slice(2)}`, values: [total - x20, x20] };
  });
  stackedColumns(root.querySelector('#chart-years'), data, ['Rev5 & legacy paths', 'FedRAMP 20x'], {
    valueLabel: (v) => `${v}`,
  });

  barList(
    root.querySelector('#chart-reuse'),
    s.topReused.slice(0, 10).map((p) => ({ label: p.cso, sub: `${p.csp} · ${p.impact}`, value: p.reuse })),
    { format: (v) => `${fmt.format(v)} reuses` }
  );
}

function renderFeed(root) {
  const feed = root.querySelector('#activity-feed');
  feed.innerHTML = '';
  for (const e of state.changelog.slice(0, 14)) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="feed-date"></span><span class="feed-status"></span><span class="feed-what"></span>`;
    li.querySelector('.feed-date').textContent = e.date;
    li.querySelector('.feed-status').textContent = e.to + (e.class ? ` · ${e.class}` : '');
    li.querySelector('.feed-what').textContent = `${e.cso} (${e.csp})`;
    feed.appendChild(li);
  }
}

function renderTable(root) {
  const tbody = root.querySelector('#product-rows');
  const search = root.querySelector('#product-search');
  const statusSel = root.querySelector('#filter-status');
  const impactSel = root.querySelector('#filter-impact');
  const countEl = root.querySelector('#product-count');
  const moreBtn = root.querySelector('#product-more');
  let shown = 25;

  // populate filter options from the data itself
  const uniq = (key) => [...new Set(state.products.map((p) => p[key]).filter(Boolean))].sort();
  statusSel.innerHTML = '<option value="">Any status</option>' + uniq('status').map((v) => `<option>${v}</option>`).join('');
  impactSel.innerHTML = '<option value="">Any impact level</option>' + uniq('impact').map((v) => `<option>${v}</option>`).join('');

  function matches() {
    const q = search.value.trim().toLowerCase();
    return state.products
      .filter((p) => (!statusSel.value || p.status === statusSel.value))
      .filter((p) => (!impactSel.value || p.impact === impactSel.value))
      .filter((p) => !q || [p.csp, p.cso, p.offering, p.assessor].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => b.reuse - a.reuse);
  }

  function draw() {
    const list = matches();
    tbody.innerHTML = '';
    for (const p of list.slice(0, shown)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="td-name"><strong></strong><span></span></td><td></td><td></td><td class="td-num"></td><td></td>`;
      const [name, status, impact, reuse, date] = tr.children;
      name.querySelector('strong').textContent = p.cso ?? '';
      name.querySelector('span').textContent = p.csp ?? '';
      status.textContent = p.status ?? '';
      impact.textContent = p.impact ?? '';
      reuse.textContent = fmt.format(p.reuse);
      date.textContent = p.authDate ?? '—';
      tbody.appendChild(tr);
    }
    countEl.textContent = `${Math.min(shown, list.length)} of ${fmt.format(list.length)} services`;
    moreBtn.style.display = list.length > shown ? '' : 'none';
  }

  for (const ctl of [search, statusSel, impactSel]) {
    ctl.addEventListener('input', () => {
      shown = 25;
      draw();
    });
  }
  moreBtn.addEventListener('click', () => {
    shown += 50;
    draw();
  });
  draw();
}

export function initLiveRefresh(root) {
  const btn = root.querySelector('#refresh-live');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Fetching from GSA’s published feed…';
    try {
      await refreshLive();
      renderMarket(root);
      btn.textContent = 'Refreshed from source ✓';
    } catch (err) {
      console.error(err);
      btn.textContent = 'Live fetch failed — still showing bundled snapshot';
      btn.disabled = false;
    }
  });
}
