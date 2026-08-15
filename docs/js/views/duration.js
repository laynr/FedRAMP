/** Duration view: how long authorization really takes, from the event log. */

import { state } from '../data.js';
import { columns, barList } from '../charts.js';
import { countUp, esc, fmt } from '../ui.js';
import { openServiceDrawer } from './services.js';

export function renderDuration() {
  const js = state.stats?.journeys;
  if (!js) return;

  const tiles = [
    { label: 'median days — all measured journeys', value: js.all.p50, note: `${fmt(js.measured)} journeys measured` },
    { label: 'median days — 20x / Program path', value: js.path20x.p50, note: `n = ${fmt(js.path20x.n)}`, accent: true },
    { label: 'median days — legacy paths', value: js.legacy.p50, note: `n = ${fmt(js.legacy.n)}` },
    { label: 'fastest journey on record', value: js.fastest[0]?.days, note: js.fastest[0]?.cso },
  ];
  const wrap = document.getElementById('dur-tiles');
  wrap.innerHTML = tiles.map((t) => `
    <div class="tile ${t.accent ? 'tile-accent' : ''}">
      <div class="tile-value">…</div>
      <div class="tile-label">${esc(t.label)}</div>
      ${t.note ? `<div class="tile-note">${esc(t.note)}</div>` : ''}
    </div>`).join('');
  [...wrap.querySelectorAll('.tile-value')].forEach((el, i) => countUp(el, tiles[i].value ?? 0));

  columns(document.getElementById('chart-histogram'), js.histogram.map((b) => ({ label: b.label, count: b.count })), {
    seriesName: 'journeys',
  });

  const fastest = document.getElementById('chart-fastest');
  barList(
    fastest,
    js.fastest.map((f) => ({ label: f.cso ?? f.id, sub: `${f.csp ?? ''}${f.is20x ? ' · 20x path' : ''} · finished ${f.end}`, value: f.days, id: f.id })),
    { format: (v) => `${fmt(v)} days` }
  );
  // make leaderboard rows open the profile drawer
  [...fastest.querySelectorAll('.barlist-row')].forEach((row, i) => {
    row.classList.add('clickable');
    row.addEventListener('click', () => openServiceDrawer(js.fastest[i].id));
  });

  document.getElementById('dur-method').innerHTML = `
    <p>A journey's duration is the gap between its <em>first in-process-type event</em> (e.g. In Process,
    Review, Initial Implementation) and its <em>first certified/authorized event</em>, in FedRAMP's published
    status-change log. ${fmt(js.measured)} of ${fmt(js.totalWithEvents)} services with events are measurable;
    the rest are excluded and counted: ${fmt(js.excluded.noEnd)} not yet finished, ${fmt(js.excluded.noStart)}
    with no recorded start (mostly pre-2024 records migrated into the log), ${fmt(js.excluded.invalidOrder)}
    with unusable ordering.</p>
    <p>Honesty caveats: migration-era records carry coarser dates, so old-journey durations are approximate;
    the log is not a complete history of every service ever authorized; and the 20x-path sample
    (n = ${fmt(js.path20x.n)}) is still small and early — the comparison is directional, not a controlled study.
    Bars in the "fastest" list are only journeys finishing since 2025. Source: the changelog export in
    <a href="https://github.com/FedRAMP/marketplace-fedramp-gov-data" target="_blank" rel="noopener">FedRAMP's marketplace data repository</a>.</p>`;
}
