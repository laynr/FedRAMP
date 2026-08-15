/**
 * Hand-rolled SVG charts. Specs follow the dataviz method: thin marks, 4px
 * rounded data-ends anchored to the baseline, 2px surface gaps between fills,
 * recessive grid, hover tooltips, text in ink tokens (never series color).
 *
 * Tooltips are DOM-built from structured data (never innerHTML) — feed-derived
 * labels are hostile input and must not reach an HTML parser.
 */

const SVGNS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.appendChild(c);
  return node;
}

function tooltip() {
  let tip = document.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    // Visual duplicate of content already accessible on the marks — hide from AT.
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    // Backstop: any scroll (page or nested container) strands a positioned tip.
    window.addEventListener('scroll', hideTip, { passive: true, capture: true });
  }
  return tip;
}

/**
 * Show the tooltip. `content` is structured — { title, lines: [...] } — and is
 * rendered via textContent only (no HTML interpretation of data values).
 */
function showTip(content, evt) {
  const tip = tooltip();
  tip.textContent = '';
  const title = document.createElement('strong');
  title.textContent = String(content?.title ?? '');
  tip.appendChild(title);
  for (const line of content?.lines ?? []) {
    if (line == null || line === '') continue;
    const div = document.createElement('div');
    div.textContent = String(line);
    tip.appendChild(div);
  }
  tip.style.display = 'block';
  const pad = 12;
  const { innerWidth } = window;
  const rect = tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  if (x + rect.width > innerWidth - 8) x = evt.clientX - rect.width - pad;
  tip.style.left = `${x + window.scrollX}px`;
  tip.style.top = `${evt.clientY + window.scrollY - rect.height - pad}px`;
}

export function hideTip() {
  const tip = document.querySelector('.chart-tip');
  if (tip) tip.style.display = 'none';
}

// One-time per-container listeners (survive innerHTML re-renders without stacking).
const tipBound = new WeakSet();
function bindTipBackstop(container) {
  if (tipBound.has(container)) return;
  tipBound.add(container);
  container.addEventListener('mouseleave', hideTip);
}

/**
 * Screen-reader data table: every chart gets a visually-hidden <table> holding
 * the same data as the marks, so the numbers aren't locked inside pixels.
 * DOM-built with textContent only — labels are feed-derived hostile input.
 * headers[0] names the row-label column; rows: [label, ...values].
 */
function dataTable(container, caption, headers, rows) {
  const table = document.createElement('table');
  table.className = 'visually-hidden';
  const cap = document.createElement('caption');
  cap.textContent = caption;
  table.appendChild(cap);
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.textContent = String(h);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const cells of rows) {
    const tr = document.createElement('tr');
    cells.forEach((c, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.setAttribute('scope', 'row');
      cell.textContent = String(c);
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderEmptyState(container, message = 'No data to chart yet.') {
  const p = document.createElement('p');
  p.className = 'chart-empty';
  p.style.color = 'var(--muted, #6b7280)';
  p.style.fontSize = '0.85rem';
  p.textContent = message;
  container.appendChild(p);
}

/**
 * Stacked column chart (two series max) with year x-axis.
 * data: [{label, values: [v1, v2]}], seriesNames: [s1, s2]
 * opts.ariaLabel: caller-provided accessible description (defaults to a
 * generic "by year" phrasing — pass one whenever the x-axis isn't years).
 */
export function stackedColumns(container, data, seriesNames, { valueLabel = null, ariaLabel = null, rowHeader = 'Category' } = {}) {
  container.innerHTML = '';
  hideTip(); // a re-render under the cursor must not strand a pinned tooltip
  bindTipBackstop(container);
  const max = data.length
    ? Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)))
    : 0;
  if (!data.length || !Number.isFinite(max) || max <= 0) {
    renderEmptyState(container);
    return;
  }
  const W = 720;
  const H = 300;
  const M = { top: 18, right: 8, bottom: 26, left: 36 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const yMax = Math.max(25, Math.ceil(max / 25) * 25);
  const y = (v) => ih - (v / yMax) * ih;
  const bw = Math.min(34, (iw / data.length) * 0.68);
  const step = iw / data.length;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': ariaLabel || `Column chart: ${seriesNames.join(' and ')} by year`,
  });
  const g = el('g', { transform: `translate(${M.left},${M.top})` });
  svg.appendChild(g);

  // recessive grid + y ticks
  for (let v = 0; v <= yMax; v += yMax / 5) {
    g.appendChild(el('line', { x1: 0, x2: iw, y1: y(v), y2: y(v), class: 'grid' }));
    const t = el('text', { x: -8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    t.textContent = String(v);
    g.appendChild(t);
  }

  data.forEach((d, i) => {
    const x = i * step + (step - bw) / 2;
    let acc = 0;
    let renderedBelow = false; // gap only when a previous segment actually drew
    const total = d.values.reduce((a, b) => a + b, 0);
    d.values.forEach((v, si) => {
      if (v <= 0) { acc += v; return; }
      const yTop = y(acc + v);
      const h = y(acc) - yTop;
      const isTopSegment = acc + v >= total;
      // 4px rounded top on the top segment only; 2px gap between stacked fills
      const gap = renderedBelow ? 2 : 0;
      const rect = el('rect', {
        x, y: yTop + gap, width: bw, height: Math.max(0, h - gap),
        rx: isTopSegment ? 4 : 0,
        class: `series-${si + 1}`,
      });
      const name = seriesNames[si];
      rect.addEventListener('mousemove', (evt) => showTip({
        title: d.label,
        lines: [`${name}: ${v}`, `total: ${total}`],
      }, evt));
      rect.addEventListener('mouseleave', hideTip);
      g.appendChild(rect);
      renderedBelow = true;
      acc += v;
    });
    // x labels (skip some if crowded)
    if (data.length <= 16 || i % 2 === 0) {
      const t = el('text', { x: x + bw / 2, y: ih + 18, class: 'tick', 'text-anchor': 'middle' });
      t.textContent = d.label;
      g.appendChild(t);
    }
    // selective direct label: the maximum stack only
    if (total === max && valueLabel) {
      const t = el('text', { x: x + bw / 2, y: y(total) - 6, class: 'direct-label', 'text-anchor': 'middle' });
      t.textContent = valueLabel(total);
      g.appendChild(t);
    }
  });

  g.appendChild(el('line', { x1: 0, x2: iw, y1: ih, y2: ih, class: 'baseline' }));
  container.appendChild(svg);

  // Same data, readable form: the SVG is a labelled image; this is the table.
  const multi = seriesNames.length > 1;
  dataTable(
    container,
    ariaLabel || `Column chart: ${seriesNames.join(' and ')} by year`,
    [rowHeader, ...seriesNames.map((n) => n || 'Value'), ...(multi ? ['Total'] : [])],
    data.map((d) => [
      d.label,
      ...d.values,
      ...(multi ? [d.values.reduce((a, b) => a + b, 0)] : []),
    ]),
  );
}

/** Single-series column chart (histogram). data: [{label, count}] */
export function columns(container, data, { seriesName = '', valueLabel = null, ariaLabel = null, rowHeader = 'Category' } = {}) {
  stackedColumns(
    container,
    data.map((d) => ({ label: d.label, values: [d.count] })),
    [seriesName],
    { valueLabel, ariaLabel, rowHeader },
  );
}

/**
 * Horizontal bar list (single series) with value labels at bar end.
 * data: [{label, sub, value}]
 */
export function barList(container, data, { format = (v) => String(v), caption = 'Chart data' } = {}) {
  container.innerHTML = '';
  hideTip();
  bindTipBackstop(container);
  if (!data.length) {
    renderEmptyState(container);
    return;
  }
  const rawMax = Math.max(...data.map((d) => Number(d.value) || 0));
  const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0;
  for (const d of data) {
    const row = document.createElement('div');
    row.className = 'barlist-row';
    const pct = max > 0 ? Math.max(1.5, (d.value / max) * 100) : 0;
    row.innerHTML = `
      <div class="barlist-label"><span class="barlist-name"></span><span class="barlist-sub"></span></div>
      <div class="barlist-track"><div class="barlist-bar" style="width:${pct}%"></div><span class="barlist-value"></span></div>`;
    row.querySelector('.barlist-name').textContent = d.label;
    row.querySelector('.barlist-sub').textContent = d.sub ?? '';
    row.querySelector('.barlist-value').textContent = format(d.value);
    row.addEventListener('mousemove', (evt) => showTip({
      title: d.label,
      lines: [d.sub ?? '', format(d.value)],
    }, evt));
    row.addEventListener('mouseleave', hideTip);
    container.appendChild(row);
  }
  dataTable(
    container,
    caption,
    ['Item', 'Details', 'Value'],
    data.map((d) => [d.label, d.sub ?? '', format(d.value)]),
  );
}
