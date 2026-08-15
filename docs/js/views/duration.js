/** Duration view: how long authorization really takes, from the event log. */

import { state } from '../data.js';
import { columns, barList } from '../charts.js';
import { countUp, esc, fmt, fmtOrDash } from '../ui.js';
import { openServiceDrawer } from './services.js';

export function renderDuration() {
  const js = state.stats?.journeys;
  const wrap = document.getElementById('dur-tiles');
  if (!js) {
    wrap.innerHTML = '<p class="sub">Journey statistics are unavailable in this dataset.</p>';
    return;
  }

  const tiles = [
    { label: 'median days — all measured journeys', value: js.all?.p50, note: `${fmtOrDash(js.measured)} journeys measured` },
    { label: 'median days — 20x / Program path', value: js.path20x?.p50, note: `n = ${fmtOrDash(js.path20x?.n)}`, accent: true },
    { label: 'median days — legacy paths', value: js.legacy?.p50, note: `n = ${fmtOrDash(js.legacy?.n)}` },
    { label: 'fastest journey on record', value: js.fastest?.[0]?.days, note: js.fastest?.[0]?.cso ?? '—' },
  ];
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

  columns(document.getElementById('chart-histogram'), (js.histogram ?? []).map((b) => ({ label: b.label, count: b.count })), {
    seriesName: 'journeys',
    ariaLabel: 'Histogram: number of journeys by days to authorization',
    rowHeader: 'Days',
  });

  renderFastest(js.fastest ?? []);

  document.getElementById('dur-method').innerHTML = `
    <p>A journey's duration is the gap between its <em>first in-process-type event</em> (e.g. In Process,
    Review, Initial Implementation) and its <em>first certified/authorized event</em>, in FedRAMP's published
    status-change log. ${fmtOrDash(js.measured)} of ${fmtOrDash(js.totalWithEvents)} services with events are measurable;
    the rest are excluded and counted: ${fmtOrDash(js.excluded?.noEnd)} not yet finished, ${fmtOrDash(js.excluded?.noStart)}
    with no recorded start (mostly pre-2024 records migrated into the log), ${fmtOrDash(js.excluded?.invalidOrder)}
    with unusable ordering.</p>
    <p>Honesty caveats: migration-era records carry coarser dates, so old-journey durations are approximate;
    the log is not a complete history of every service ever authorized; and the 20x-path sample
    (n = ${fmtOrDash(js.path20x?.n)}) is still small and early — the comparison is directional, not a controlled study.
    Two structural biases favor the 20x number: only <em>finished</em> journeys are measured, and the 20x program
    is young enough that a long 20x journey cannot exist yet (right-censoring), while legacy paths include
    decade-spanning completions from slower eras. And a service that switched paths mid-journey is attributed
    to 20x if <em>any</em> of its events carry a 20x marker.
    Bars in the "fastest" list are only journeys finishing since 2025. Source: the changelog export in
    <a href="https://github.com/FedRAMP/marketplace-fedramp-gov-data" target="_blank" rel="noopener">FedRAMP's marketplace data repository</a>.</p>`;
}

/**
 * Leaderboard rows open the profile drawer. Rows are addressed by data-id
 * (never list position) with ONE delegated listener on the static container,
 * so re-renders can't stack handlers or drift out of sync with the data.
 * barList emits divs — each row is upgraded to a keyboard-reachable button.
 */
function renderFastest(fastestList) {
  const container = document.getElementById('chart-fastest');
  if (!container.dataset.wired) {
    container.dataset.wired = '1';
    const activate = (e) => {
      const row = e.target.closest('.barlist-row[data-id]');
      if (!row || !container.contains(row)) return;
      if (e.type === 'keydown') {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
      }
      openServiceDrawer(row.dataset.id);
    };
    container.addEventListener('click', activate);
    container.addEventListener('keydown', activate);
  }

  barList(
    container,
    fastestList.map((f) => ({ label: f.cso ?? f.id, sub: `${f.csp ?? ''}${f.is20x ? ' · 20x path' : ''} · finished ${f.end}`, value: f.days, id: f.id })),
    { format: (v) => `${fmt(v)} days`, caption: 'Fastest journeys finished since 2025' }
  );

  [...container.querySelectorAll('.barlist-row')].forEach((row, i) => {
    const f = fastestList[i];
    if (!f?.id) return;
    row.dataset.id = f.id;
    row.classList.add('clickable');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `${f.cso ?? f.id}: ${fmtOrDash(f.days)} days — open service profile`);
  });
}
