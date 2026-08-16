/** Pulse view: since-you-were-here card, animated tiles, live activity stream. */

import { state, refreshLive, freshnessLabel, relativeDate } from '../data.js';
import { stackedColumns, barList } from '../charts.js';
import { countUp, esc, fmt, fmtOrDash } from '../ui.js';
import { fingerprint, diffFingerprints } from '../watchlist.js';
import { getWatchlist, commitFingerprints, markVisited, onWatchChange, openServiceDrawer } from './services.js';

export function renderPulse() {
  renderWatchCard();
  renderTiles();
  renderStream();
  renderYearsChart();
  renderTopReused();
  document.getElementById('data-freshness').textContent = freshnessLabel();
  renderProvenance();
  wireLiveButton();
  onWatchChange(renderWatchCard); // Set-backed: same fn ref, registered once
}

function renderProvenance() {
  const root = document.getElementById('data-provenance');
  if (!root) return;
  root.textContent = '';
  const sources = state.meta?.sources ?? {};
  const rows = [
    ['Marketplace', sources.marketplace],
    ['Changelog', sources.changelog],
    ['Rules', sources.rules],
  ].filter(([, source]) => source);
  if (!rows.some(([, source]) => source.commit && source.sha256)) {
    const p = document.createElement('p');
    p.className = 'sub';
    p.textContent = 'This older snapshot does not include immutable revision metadata.';
    root.appendChild(p);
    return;
  }

  const intro = document.createElement('p');
  intro.className = 'sub';
  intro.textContent = `${state.live ? 'Live refresh' : 'Bundled snapshot'}: branch heads were resolved to immutable Git commits; each file matched the blob recorded at that commit and was SHA-256 digested before parsing.`;
  root.appendChild(intro);
  const dl = document.createElement('dl');
  dl.className = 'provenance-list';
  for (const [label, source] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (source.url && source.commit) {
      const a = document.createElement('a');
      a.href = source.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = source.commit.slice(0, 12);
      a.setAttribute('aria-label', `${label} exact source at commit ${source.commit} (opens in a new tab)`);
      dd.appendChild(a);
    } else {
      dd.append(source.commit?.slice(0, 12) ?? '—');
    }
    if (source.blobSha) dd.append(` · Git blob ${source.blobSha.slice(0, 12)} verified`);
    if (source.sha256) dd.append(` · SHA-256 ${source.sha256.slice(0, 16)}…`);
    if (Number.isFinite(source.bytes)) dd.append(` · ${fmt(source.bytes)} bytes`);
    dl.append(dt, dd);
  }
  root.appendChild(dl);
}

// ---------- "since you were last here" ----------

// savedAt captured at first render so the "(3d ago)" label stays stable for
// the whole session, even after fingerprints commit / savedAt advances (M8).
let sessionSince;
let visitedMarked = false;

function renderWatchCard() {
  const el = document.getElementById('watch-card');
  const watch = getWatchlist();

  if (!watch.starred.length) {
    el.innerHTML = `<div class="panel watch empty">
      <strong>Make this page yours:</strong> star <span class="star starred" aria-hidden="true">★</span> the services you care about
      (yours, competitors, dependencies) — your next visit starts with what changed.
      <button class="ghost-btn" data-goto="services">Browse services <span aria-hidden="true">→</span></button>
    </div>`;
    el.querySelector('[data-goto]').addEventListener('click', () => document.querySelector('.tab[data-view="services"]').click());
    return;
  }

  if (sessionSince === undefined) sessionSince = watch.savedAt;
  const since = sessionSince ? relativeDate(String(sessionSince).slice(0, 10)) : null;

  // Null-prototype map: starred ids come from storage/feed — "__proto__" must stay inert.
  const current = Object.create(null);
  for (const id of watch.starred) {
    if (state.productsById.has(id)) {
      current[id] = fingerprint(state.productsById.get(id), state.journeysById.get(id));
    }
  }
  const missing = watch.starred.filter((id) => !state.productsById.has(id)).length;
  const watching = watch.starred.length - missing;
  const missingNote = missing ? ` <span class="sub">+${missing} no longer listed</span>` : '';

  const diffs = diffFingerprints(watch.fingerprints, current);

  if (!diffs.length) {
    el.innerHTML = `<div class="panel watch">
      <strong>Watching ${watching} service${watching === 1 ? '' : 's'}</strong>${missingNote}
      <span class="sub">— no changes${since ? ` since your last visit (${since})` : ' yet'}. We’ll flag anything that moves.</span>
    </div>`;
  } else {
    el.innerHTML = `<div class="panel watch changed">
      <strong>Since you were last here${since ? ` (${since})` : ''}:</strong>${missingNote}
      ${diffs.map((d) => {
        const p = state.productsById.get(d.id);
        const parts = d.changes.map((c) =>
          c.field === 'listed'
            ? '<strong>no longer in the marketplace feed</strong>'
            : `${c.field === 'latest' ? 'status event' : c.field}: ${esc(c.from)} <span aria-hidden="true">→</span><span class="visually-hidden">changed to</span> <strong>${esc(c.to)}</strong>`
        ).join(' · ');
        const name = `<span class="watch-name">${esc(p?.cso ?? d.id)}</span>`;
        // Only resolvable services get a button (there is a profile to open).
        return p
          ? `<button class="watch-diff" data-open="${esc(d.id)}">${name} ${parts}</button>`
          : `<div class="watch-diff">${name} ${parts}</div>`;
      }).join('')}
    </div>`;
    el.querySelectorAll('[data-open]').forEach((row) =>
      row.addEventListener('click', () => openServiceDrawer(row.dataset.open))
    );
  }
  // Diff against STORED fingerprints, render, THEN commit — and only when
  // something actually changed (avoids a redundant write on every repaint).
  if (diffs.length) commitFingerprints();
  if (!visitedMarked) {
    visitedMarked = true;
    markVisited(); // savedAt advances exactly once per page load
  }
}

// ---------- tiles ----------

function renderTiles() {
  const s = state.stats ?? {};
  const byStatus = s.totals?.byStatus;
  const js = s.journeys;
  const tiles = [
    { label: 'services FedRAMP Authorized', value: byStatus?.['FedRAMP Authorized'] },
    { label: 'in process right now', value: byStatus ? (byStatus['FedRAMP In Process'] ?? 0) + (byStatus['Agency In Process'] ?? 0) : null },
    { label: 'authorized under 20x', value: s.totals?.authorized20x },
    {
      label: 'median days to certified — 20x path',
      value: js?.path20x?.p50,
      note: `vs ${fmtOrDash(js?.legacy?.p50)} on legacy paths · n = ${fmtOrDash(js?.path20x?.n)} recent journeys — see “How long?” for method`,
      accent: true,
    },
  ];
  const wrap = document.getElementById('pulse-tiles');
  wrap.innerHTML = tiles.map((t) => `
    <div class="tile ${t.accent ? 'tile-accent' : ''}">
      <div class="tile-value">…</div>
      <div class="tile-label">${esc(t.label)}</div>
      ${t.note ? `<div class="tile-note">${esc(t.note)}</div>` : ''}
    </div>`).join('');
  [...wrap.querySelectorAll('.tile-value')].forEach((el, i) => {
    const v = tiles[i].value;
    if (v == null || Number.isNaN(Number(v))) el.textContent = '—';
    else countUp(el, Number(v));
  });
}

// ---------- activity stream ----------

function renderStream() {
  const feed = document.getElementById('activity-stream');
  feed.innerHTML = (state.activity ?? []).slice(0, 22).map((e) => {
    if (e.kind === 'reuse') {
      return `<li><span class="feed-date">${relativeDate(e.date)}</span>
        <span class="feed-icon" title="agency adoption" aria-hidden="true">🏛️</span>
        <span class="feed-what"><strong>${esc(e.agency)}</strong> adopted ${esc(e.cso)} <span class="sub">(${esc(e.csp)})</span></span></li>`;
    }
    return `<li><span class="feed-date">${relativeDate(e.date)}</span>
      <span class="feed-icon" title="status change" aria-hidden="true">＋</span>
      <span class="feed-what">${esc(e.cso)} <span class="sub">(${esc(e.csp)})</span> <span aria-hidden="true">→</span><span class="visually-hidden">changed to</span> <strong>${esc(e.to)}</strong>${e.class ? ` <span class="pill">${esc(e.class)}</span>` : ''}</span></li>`;
  }).join('');
}

// ---------- charts ----------

function renderYearsChart() {
  const s = state.stats ?? {};
  const byYear = s.authsByYear ?? {};
  const byYear20x = s.authsByYear20x ?? {};
  const years = Object.keys(byYear).sort();
  const data = years.map((yr) => ({
    label: `’${yr.slice(2)}`,
    values: [(byYear[yr] ?? 0) - (byYear20x[yr] ?? 0), byYear20x[yr] ?? 0],
  }));
  stackedColumns(document.getElementById('chart-years'), data, ['Rev5 & legacy paths', 'FedRAMP 20x'], {
    valueLabel: (v) => `${v}`,
    ariaLabel: 'Authorized services per year, split by path',
    rowHeader: 'Year',
  });
}

/**
 * Most-reused authorizations — reuse is the whole point of the program.
 * The panel is created from JS (index.html carries no static element for it);
 * rows are informational only: stats.topReused carries no product ids.
 */
function renderTopReused() {
  let panel = document.getElementById('panel-top-reused');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel-top-reused';
    panel.className = 'panel';
    const h = document.createElement('h3');
    h.textContent = 'Most-reused authorizations';
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = 'Reuse is the whole point: prove security once, and agencies across government adopt it.';
    const chart = document.createElement('div');
    chart.id = 'chart-top-reused';
    panel.append(h, sub, chart);
    const freshPanel = document.getElementById('data-freshness')?.closest('.panel');
    if (freshPanel?.parentElement) freshPanel.parentElement.insertBefore(panel, freshPanel);
    else document.getElementById('view-pulse')?.appendChild(panel);
  }
  barList(
    document.getElementById('chart-top-reused'),
    (state.stats?.topReused ?? []).slice(0, 8).map((t) => ({
      label: t.cso,
      sub: `${t.csp ?? ''}${t.impact ? ` · ${t.impact}` : ''}`,
      value: t.reuse,
    })),
    { format: (v) => `${fmt(v)} reuses`, caption: 'Most-reused authorizations' }
  );
}

// ---------- live refresh ----------

function wireLiveButton() {
  const btn = document.getElementById('refresh-live');
  if (!btn || btn.dataset.wired) return; // renderPulse re-runs after live refresh; wire once
  btn.dataset.wired = '1';
  const idleLabel = btn.textContent;
  // Mirror the outcome into a visually-hidden polite live region — a screen
  // reader hears the result even though only the button's text changes.
  const announce = (msg) => {
    const status = document.getElementById('refresh-status');
    if (status) status.textContent = msg;
  };
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Fetching from GSA’s published feed…';
    announce('');
    try {
      await refreshLive(); // onStateChange re-renders every view, including this one
      btn.textContent = 'Refreshed from source ✓';
      announce(`Refreshed from source. ${freshnessLabel()}`);
      setTimeout(() => {
        btn.textContent = idleLabel;
        btn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error(err);
      btn.textContent = 'Live fetch failed — still on bundled snapshot';
      announce('Live fetch failed — still on bundled snapshot.');
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = idleLabel;
      }, 4000);
    }
  });
}
