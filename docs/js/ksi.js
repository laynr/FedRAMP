/**
 * KSI Explorer + self-check study aid.
 * Renders the official Key Security Indicator catalog (from FedRAMP/rules,
 * machine-readable) and lets you tick indicators you believe you meet.
 * Progress persists in localStorage (guarded — Safari private mode throws).
 * Explicitly a study aid, not an assessment.
 */

import { esc, storage } from './ui.js';

const STORE_KEY = 'fedramp-ksi-selfcheck-v1';

function loadChecks(validIds) {
  try {
    const parsed = JSON.parse(storage.get(STORE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && validIds.has(x)) : []);
  } catch {
    return new Set();
  }
}

function saveChecks(set) {
  storage.set(STORE_KEY, JSON.stringify([...set]));
}

// Family ids come from the feed — make them safe to use as DOM ids.
function famTabId(id) {
  return `ksi-tab-${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function initKsi(root, ksi) {
  const validIds = new Set(ksi.families.flatMap((family) => family.indicators.map((indicator) => indicator.id)));
  const checks = loadChecks(validIds);
  const controller = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: controller.signal });
  const famNav = root.querySelector('#ksi-families');
  const detail = root.querySelector('#ksi-detail');
  const ring = root.querySelector('#ksi-ring');
  const ringWrap = root.querySelector('#ksi-ring-wrap');
  const ringLabel = root.querySelector('#ksi-ring-label');
  const meta = root.querySelector('#ksi-meta');
  let activeFam = ksi.families[0]?.id;

  const totalIndicators = ksi.families.reduce((a, f) => a + f.indicators.length, 0);
  meta.textContent = `${ksi.families.length} families · ${totalIndicators} indicators · rules version ${ksi.version} (updated ${ksi.updated})`;

  // Tab pattern: family buttons are tabs (roving tabindex), detail is the panel.
  // The container's role="tablist" lives in index.html.
  detail.setAttribute('role', 'tabpanel');
  detail.setAttribute('tabindex', '0');

  // Progress semantics: the ring + "12/46" text are one unit for a screen reader.
  ringWrap.setAttribute('role', 'progressbar');
  ringWrap.setAttribute('aria-label', 'Self-check progress');
  ringWrap.setAttribute('aria-valuemin', '0');
  ringWrap.setAttribute('aria-valuemax', String(totalIndicators));

  function updateRing() {
    const done = checks.size;
    const pct = totalIndicators ? Math.round((done / totalIndicators) * 100) : 0;
    const C = 2 * Math.PI * 26;
    ring.setAttribute('stroke-dasharray', `${(pct / 100) * C} ${C}`);
    ringLabel.textContent = `${done}/${totalIndicators}`;
    ringWrap.setAttribute('aria-valuenow', String(done));
    ringWrap.setAttribute('aria-valuetext', `${done} of ${totalIndicators} indicators checked`);
    if (done === totalIndicators && totalIndicators > 0) {
      root.classList.add('celebrate'); // one tasteful moment; CSS no-ops under prefers-reduced-motion
      setTimeout(() => root.classList.remove('celebrate'), 900);
    }
  }

  function famProgress(f) {
    const done = f.indicators.filter((i) => checks.has(i.id)).length;
    return `${done}/${f.indicators.length}`;
  }

  function activateFam(index, { focus = false } = {}) {
    const n = ksi.families.length;
    if (!n) return;
    const i = ((index % n) + n) % n;
    activeFam = ksi.families[i].id;
    renderNav();
    renderDetail();
    if (focus) famNav.querySelector('[aria-selected="true"]')?.focus();
  }

  function renderNav() {
    famNav.innerHTML = '';
    for (const f of ksi.families) {
      const isActive = f.id === activeFam;
      const btn = document.createElement('button');
      btn.className = 'ksi-fam' + (isActive ? ' active' : '');
      btn.id = famTabId(f.id);
      btn.dataset.familyId = f.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('aria-controls', detail.id || 'ksi-detail');
      btn.tabIndex = isActive ? 0 : -1; // roving tabindex
      btn.innerHTML = `<span class="ksi-fam-id"></span><span class="ksi-fam-name"></span><span class="ksi-fam-count"></span>`;
      btn.querySelector('.ksi-fam-id').textContent = f.short;
      btn.querySelector('.ksi-fam-name').textContent = f.name;
      btn.querySelector('.ksi-fam-count').textContent = famProgress(f);
      famNav.appendChild(btn);
    }
  }

  listen(famNav, 'click', (e) => {
    const btn = e.target.closest('.ksi-fam[data-family-id]');
    if (!btn || !famNav.contains(btn)) return;
    activeFam = btn.dataset.familyId;
    renderNav();
    renderDetail();
  });

  listen(famNav, 'keydown', (e) => {
    const idx = ksi.families.findIndex((f) => f.id === activeFam);
    if (idx < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      activateFam(idx + 1, { focus: true });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      activateFam(idx - 1, { focus: true });
    } else if (e.key === 'Home') {
      e.preventDefault();
      activateFam(0, { focus: true });
    } else if (e.key === 'End') {
      e.preventDefault();
      activateFam(ksi.families.length - 1, { focus: true });
    }
  });

  function renderDetail() {
    const f = ksi.families.find((x) => x.id === activeFam);
    if (!f) return;
    detail.setAttribute('aria-labelledby', famTabId(f.id));
    detail.innerHTML = `<h3>${esc(f.id)} — ${esc(f.name)}</h3>`;
    for (const ind of f.indicators) {
      const item = document.createElement('label');
      item.className = 'ksi-ind';
      const classNote = ind.classes
        ? `<p class="ksi-classes">Varies by class: ${Object.entries(ind.classes)
            .map(([c, v]) => `<strong>Class ${esc(c.toUpperCase())}</strong> — ${esc(v.statement ?? '')}`)
            .join(' · ')}</p>`
        : '';
      item.innerHTML = `
        <input type="checkbox" ${checks.has(ind.id) ? 'checked' : ''} aria-label="Mark ${esc(ind.id)} ${esc(ind.name)} as met (study aid)">
        <span class="ksi-ind-body">
          <span class="ksi-ind-head"><code>${esc(ind.id)}</code> <strong></strong></span>
          <span class="ksi-ind-statement"></span>
          ${classNote}
          <span class="ksi-ind-controls">${ind.controls.length ? 'NIST SP 800-53: ' + ind.controls.map((c) => `<code>${esc(c)}</code>`).join(' ') : ''}</span>
        </span>`;
      item.querySelector('strong').textContent = ind.name;
      item.querySelector('.ksi-ind-statement').textContent = ind.statement;
      item.querySelector('input').dataset.indicatorId = ind.id;
      detail.appendChild(item);
    }
  }

  listen(detail, 'change', (e) => {
    const input = e.target.closest('input[data-indicator-id]');
    if (!input || !detail.contains(input)) return;
    if (input.checked) checks.add(input.dataset.indicatorId);
    else checks.delete(input.dataset.indicatorId);
    saveChecks(checks);
    updateRing();
    renderNav();
  });

  listen(root.querySelector('#ksi-export'), 'click', () => {
    const lines = [
      `# KSI self-check — gap list`,
      ``,
      `Generated ${new Date().toISOString().slice(0, 10)} from FedRAMP Consolidated Rules ${ksi.version} (study aid, not an assessment).`,
      ``,
    ];
    for (const f of ksi.families) {
      const gaps = f.indicators.filter((i) => !checks.has(i.id));
      if (!gaps.length) continue;
      lines.push(`## ${f.id} — ${f.name} (${gaps.length} to review)`, ``);
      for (const g of gaps) lines.push(`- [ ] **${g.id}** ${g.name}: ${g.statement}`);
      lines.push(``);
    }
    if (lines.length === 4) lines.push(`No gaps marked — every indicator is checked. Nice.`);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ksi-gap-list.md';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  listen(root.querySelector('#ksi-reset'), 'click', () => {
    checks.clear();
    saveChecks(checks);
    updateRing();
    renderNav();
    renderDetail();
  });

  renderNav();
  renderDetail();
  updateRing();
  return () => controller.abort();
}
