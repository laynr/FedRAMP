/**
 * KSI Explorer + self-check study aid.
 * Renders the official Key Security Indicator catalog (from FedRAMP/rules,
 * machine-readable) and lets you tick indicators you believe you meet.
 * Progress persists in localStorage. Explicitly a study aid, not an assessment.
 */

const STORE_KEY = 'fedramp-ksi-selfcheck-v1';

function loadChecks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveChecks(set) {
  localStorage.setItem(STORE_KEY, JSON.stringify([...set]));
}

export function initKsi(root, ksi) {
  const checks = loadChecks();
  const famNav = root.querySelector('#ksi-families');
  const detail = root.querySelector('#ksi-detail');
  const ring = root.querySelector('#ksi-ring');
  const ringLabel = root.querySelector('#ksi-ring-label');
  const meta = root.querySelector('#ksi-meta');
  let activeFam = ksi.families[0]?.id;

  const totalIndicators = ksi.families.reduce((a, f) => a + f.indicators.length, 0);
  meta.textContent = `${ksi.families.length} families · ${totalIndicators} indicators · rules version ${ksi.version} (updated ${ksi.updated})`;

  function updateRing() {
    const done = checks.size;
    const pct = totalIndicators ? Math.round((done / totalIndicators) * 100) : 0;
    const C = 2 * Math.PI * 26;
    ring.style.strokeDasharray = `${(pct / 100) * C} ${C}`;
    ringLabel.textContent = `${done}/${totalIndicators}`;
    if (done === totalIndicators && totalIndicators > 0) {
      root.classList.add('celebrate'); // one tasteful moment; CSS no-ops under prefers-reduced-motion
      setTimeout(() => root.classList.remove('celebrate'), 900);
    }
  }

  function famProgress(f) {
    const done = f.indicators.filter((i) => checks.has(i.id)).length;
    return `${done}/${f.indicators.length}`;
  }

  function renderNav() {
    famNav.innerHTML = '';
    for (const f of ksi.families) {
      const btn = document.createElement('button');
      btn.className = 'ksi-fam' + (f.id === activeFam ? ' active' : '');
      btn.innerHTML = `<span class="ksi-fam-id"></span><span class="ksi-fam-name"></span><span class="ksi-fam-count"></span>`;
      btn.querySelector('.ksi-fam-id').textContent = f.short;
      btn.querySelector('.ksi-fam-name').textContent = f.name;
      btn.querySelector('.ksi-fam-count').textContent = famProgress(f);
      btn.addEventListener('click', () => {
        activeFam = f.id;
        renderNav();
        renderDetail();
      });
      famNav.appendChild(btn);
    }
  }

  function renderDetail() {
    const f = ksi.families.find((x) => x.id === activeFam);
    if (!f) return;
    detail.innerHTML = `<h4>${f.id} — ${f.name}</h4>`;
    for (const ind of f.indicators) {
      const item = document.createElement('label');
      item.className = 'ksi-ind';
      const classNote = ind.classes
        ? `<p class="ksi-classes">Varies by class: ${Object.entries(ind.classes)
            .map(([c, v]) => `<strong>Class ${c.toUpperCase()}</strong> — ${escapeHtml(v.statement ?? '')}`)
            .join(' · ')}</p>`
        : '';
      item.innerHTML = `
        <input type="checkbox" ${checks.has(ind.id) ? 'checked' : ''} aria-label="Mark ${ind.id} as met (study aid)">
        <span class="ksi-ind-body">
          <span class="ksi-ind-head"><code>${ind.id}</code> <strong></strong></span>
          <span class="ksi-ind-statement"></span>
          ${classNote}
          <span class="ksi-ind-controls">${ind.controls.length ? 'NIST SP 800-53: ' + ind.controls.map((c) => `<code>${c}</code>`).join(' ') : ''}</span>
        </span>`;
      item.querySelector('strong').textContent = ind.name;
      item.querySelector('.ksi-ind-statement').textContent = ind.statement;
      item.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) checks.add(ind.id);
        else checks.delete(ind.id);
        saveChecks(checks);
        updateRing();
        renderNav();
      });
      detail.appendChild(item);
    }
  }

  root.querySelector('#ksi-export').addEventListener('click', () => {
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

  root.querySelector('#ksi-reset').addEventListener('click', () => {
    checks.clear();
    saveChecks(checks);
    updateRing();
    renderNav();
    renderDetail();
  });

  renderNav();
  renderDetail();
  updateRing();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
