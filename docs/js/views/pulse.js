/** Pulse view: since-you-were-here card, animated tiles, live activity stream. */

import { state, refreshLive, freshnessLabel, relativeDate } from '../data.js';
import { stackedColumns } from '../charts.js';
import { countUp, esc, fmt } from '../ui.js';
import { fingerprint, diffFingerprints } from '../watchlist.js';
import { getWatchlist, commitFingerprints, onWatchChange, openServiceDrawer } from './services.js';

export function renderPulse() {
  renderWatchCard();
  renderTiles();
  renderStream();
  renderYearsChart();
  document.getElementById('data-freshness').textContent = freshnessLabel();
  wireLiveButton();
  onWatchChange(renderWatchCard);
}

// ---------- "since you were last here" ----------

function renderWatchCard() {
  const el = document.getElementById('watch-card');
  const watch = getWatchlist();

  if (!watch.starred.length) {
    el.innerHTML = `<div class="panel watch empty">
      <strong>Make this page yours:</strong> star <span class="star starred">★</span> the services you care about
      (yours, competitors, dependencies) — your next visit starts with what changed.
      <button class="ghost-btn" data-goto="services">Browse services →</button>
    </div>`;
    el.querySelector('[data-goto]').addEventListener('click', () => document.querySelector('.tab[data-view="services"]').click());
    return;
  }

  const current = {};
  for (const id of watch.starred) {
    current[id] = fingerprint(state.productsById.get(id), state.journeysById.get(id));
  }
  const diffs = diffFingerprints(watch.fingerprints, current);
  const since = watch.savedAt ? relativeDate(watch.savedAt.slice(0, 10)) : null;

  if (!diffs.length) {
    el.innerHTML = `<div class="panel watch">
      <strong>Watching ${watch.starred.length} service${watch.starred.length === 1 ? '' : 's'}</strong>
      <span class="sub">— no changes${since ? ` since your last visit (${since})` : ' yet'}. We’ll flag anything that moves.</span>
    </div>`;
  } else {
    el.innerHTML = `<div class="panel watch changed">
      <strong>Since you were last here${since ? ` (${since})` : ''}:</strong>
      ${diffs.map((d) => {
        const p = state.productsById.get(d.id);
        const parts = d.changes.map((c) => `${c.field === 'latest' ? 'status event' : c.field}: ${esc(c.from)} → <strong>${esc(c.to)}</strong>`).join(' · ');
        return `<div class="watch-diff" data-open="${esc(d.id)}"><span class="watch-name">${esc(p?.cso ?? d.id)}</span> ${parts}</div>`;
      }).join('')}
    </div>`;
    el.querySelectorAll('[data-open]').forEach((row) =>
      row.addEventListener('click', () => openServiceDrawer(row.dataset.open))
    );
  }
  commitFingerprints();
}

// ---------- tiles ----------

function renderTiles() {
  const s = state.stats;
  const js = s.journeys;
  const tiles = [
    { label: 'services FedRAMP Authorized', value: s.totals.byStatus['FedRAMP Authorized'] ?? 0 },
    { label: 'in process right now', value: (s.totals.byStatus['FedRAMP In Process'] ?? 0) + (s.totals.byStatus['Agency In Process'] ?? 0) },
    { label: 'authorized under 20x', value: s.totals.authorized20x },
    { label: 'median days to certified — 20x path', value: js?.path20x?.p50, note: `vs ${fmt(js?.legacy?.p50)} on legacy paths`, accent: true },
  ];
  const wrap = document.getElementById('pulse-tiles');
  wrap.innerHTML = tiles.map((t) => `
    <div class="tile ${t.accent ? 'tile-accent' : ''}">
      <div class="tile-value">…</div>
      <div class="tile-label">${esc(t.label)}</div>
      ${t.note ? `<div class="tile-note">${esc(t.note)}</div>` : ''}
    </div>`).join('');
  [...wrap.querySelectorAll('.tile-value')].forEach((el, i) => countUp(el, tiles[i].value ?? 0));
}

// ---------- activity stream ----------

function renderStream() {
  const feed = document.getElementById('activity-stream');
  feed.innerHTML = state.activity.slice(0, 22).map((e) => {
    if (e.kind === 'reuse') {
      return `<li><span class="feed-date">${relativeDate(e.date)}</span>
        <span class="feed-icon" title="agency adoption">🏛️</span>
        <span class="feed-what"><strong>${esc(e.agency)}</strong> adopted ${esc(e.cso)} <span class="sub">(${esc(e.csp)})</span></span></li>`;
    }
    return `<li><span class="feed-date">${relativeDate(e.date)}</span>
      <span class="feed-icon" title="status change">＋</span>
      <span class="feed-what">${esc(e.cso)} <span class="sub">(${esc(e.csp)})</span> → <strong>${esc(e.to)}</strong>${e.class ? ` <span class="pill">${esc(e.class)}</span>` : ''}</span></li>`;
  }).join('');
}

// ---------- chart ----------

function renderYearsChart() {
  const s = state.stats;
  const years = Object.keys(s.authsByYear).sort();
  const data = years.map((yr) => ({
    label: `’${yr.slice(2)}`,
    values: [(s.authsByYear[yr] ?? 0) - (s.authsByYear20x[yr] ?? 0), s.authsByYear20x[yr] ?? 0],
  }));
  stackedColumns(document.getElementById('chart-years'), data, ['Rev5 & legacy paths', 'FedRAMP 20x'], {
    valueLabel: (v) => `${v}`,
  });
}

// ---------- live refresh ----------

function wireLiveButton() {
  const btn = document.getElementById('refresh-live');
  if (btn.dataset.wired) return; // renderPulse re-runs after live refresh; wire once
  btn.dataset.wired = '1';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Fetching from GSA’s published feed…';
    try {
      await refreshLive();
      renderPulse();
      btn.textContent = 'Refreshed from source ✓';
    } catch (err) {
      console.error(err);
      btn.textContent = 'Live fetch failed — still on bundled snapshot';
      btn.disabled = false;
    }
  });
}
