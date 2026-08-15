/**
 * Hand-rolled SVG charts. Specs follow the dataviz method: thin marks, 4px
 * rounded data-ends anchored to the baseline, 2px surface gaps between fills,
 * recessive grid, hover tooltips, text in ink tokens (never series color).
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
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
  }
  return tip;
}

function showTip(html, evt) {
  const tip = tooltip();
  tip.innerHTML = html;
  tip.style.display = 'block';
  const pad = 12;
  const { innerWidth } = window;
  const rect = tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  if (x + rect.width > innerWidth - 8) x = evt.clientX - rect.width - pad;
  tip.style.left = `${x + window.scrollX}px`;
  tip.style.top = `${evt.clientY + window.scrollY - rect.height - pad}px`;
}

function hideTip() {
  const tip = tooltip();
  tip.style.display = 'none';
}

/**
 * Stacked column chart (two series max) with year x-axis.
 * data: [{label, values: [v1, v2]}], seriesNames: [s1, s2]
 */
export function stackedColumns(container, data, seriesNames, { valueLabel = null } = {}) {
  container.innerHTML = '';
  const W = 720;
  const H = 300;
  const M = { top: 18, right: 8, bottom: 26, left: 36 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const max = Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const yMax = Math.ceil(max / 25) * 25;
  const y = (v) => ih - (v / yMax) * ih;
  const bw = Math.min(34, (iw / data.length) * 0.68);
  const step = iw / data.length;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Column chart: ${seriesNames.join(' and ')} by year` });
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
    const total = d.values.reduce((a, b) => a + b, 0);
    d.values.forEach((v, si) => {
      if (v <= 0) { acc += v; return; }
      const yTop = y(acc + v);
      const h = y(acc) - yTop;
      const isTopSegment = acc + v >= total;
      // 4px rounded top on the top segment only; 2px gap between stacked fills
      const gap = si > 0 ? 2 : 0;
      const rect = el('rect', {
        x, y: yTop + gap, width: bw, height: Math.max(0, h - gap),
        rx: isTopSegment ? 4 : 0,
        class: `series-${si + 1}`,
      });
      const name = seriesNames[si];
      rect.addEventListener('mousemove', (evt) => showTip(`<strong>${d.label}</strong><br>${name}: ${v}<br>total: ${total}`, evt));
      rect.addEventListener('mouseleave', hideTip);
      g.appendChild(rect);
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
}

/** Single-series column chart (histogram). data: [{label, count}] */
export function columns(container, data, { seriesName = '', valueLabel = null } = {}) {
  stackedColumns(container, data.map((d) => ({ label: d.label, values: [d.count] })), [seriesName], { valueLabel });
}

/**
 * Horizontal bar list (single series) with value labels at bar end.
 * data: [{label, sub, value}]
 */
export function barList(container, data, { format = (v) => String(v) } = {}) {
  container.innerHTML = '';
  const max = Math.max(...data.map((d) => d.value));
  for (const d of data) {
    const row = document.createElement('div');
    row.className = 'barlist-row';
    const pct = Math.max(1.5, (d.value / max) * 100);
    row.innerHTML = `
      <div class="barlist-label"><span class="barlist-name"></span><span class="barlist-sub"></span></div>
      <div class="barlist-track"><div class="barlist-bar" style="width:${pct}%"></div><span class="barlist-value">${format(d.value)}</span></div>`;
    row.querySelector('.barlist-name').textContent = d.label;
    row.querySelector('.barlist-sub').textContent = d.sub ?? '';
    row.addEventListener('mousemove', (evt) => showTip(`<strong>${d.label}</strong><br>${d.sub ?? ''}<br>${format(d.value)}`, evt));
    row.addEventListener('mouseleave', hideTip);
    container.appendChild(row);
  }
}
