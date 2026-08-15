/**
 * Page bootstrap: theme, scroll progress, countdowns, quiz checkpoints,
 * class picker, data loading, section wiring.
 */

import { loadSnapshot, state } from './data.js';
import { wireCitations, renderSourceList } from './sources.js';
import { initKsi } from './ksi.js';
import { renderMarket, initLiveRefresh } from './market.js';

// ---------- theme ----------
const themeBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
themeBtn.addEventListener('click', () => {
  const cur =
    document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// ---------- scroll progress ----------
const progress = document.getElementById('read-progress');
addEventListener(
  'scroll',
  () => {
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    progress.style.width = `${pct}%`;
  },
  { passive: true }
);

// ---------- countdowns (compute client-side so they age gracefully) ----------
const DAY = 86_400_000;
const daysUntil = (iso) => Math.ceil((new Date(`${iso}T00:00:00`) - Date.now()) / DAY);

function renderCountdowns() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const d = daysUntil(el.dataset.deadline);
    const what = el.dataset.what;
    el.textContent =
      d > 1 ? `${what} in ${d} days` :
      d === 1 ? `${what} tomorrow` :
      d === 0 ? `${what} today` :
      `${el.dataset.after ?? what} ${-d} days ago`;
    el.classList.toggle('past', d < 0);
  }
}
renderCountdowns();

// ---------- quiz checkpoints ----------
for (const quiz of document.querySelectorAll('.quiz')) {
  const answer = quiz.dataset.answer;
  const explain = quiz.querySelector('.quiz-explain');
  quiz.querySelectorAll('button[data-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const right = btn.dataset.opt === answer;
      quiz.querySelectorAll('button[data-opt]').forEach((b) => {
        b.disabled = true;
        if (b.dataset.opt === answer) b.classList.add('correct');
      });
      btn.classList.add(right ? 'correct' : 'incorrect');
      explain.hidden = false;
    });
  });
}

// ---------- class picker ----------
const picker = document.getElementById('class-picker');
if (picker) {
  const cards = picker.querySelectorAll('.picker-card');
  picker.querySelectorAll('button[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('button[data-pick]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cards.forEach((c) => (c.hidden = c.dataset.card !== btn.dataset.pick));
    });
  });
}

// ---------- data-driven sections ----------
async function boot() {
  const note = document.getElementById('data-note');
  try {
    await loadSnapshot();
  } catch (err) {
    console.error('snapshot load failed', err);
    note.textContent = 'Data failed to load — the explainer text still works; tools are unavailable.';
    return;
  }

  // hero live figures
  const authorized = state.stats.totals.byStatus['FedRAMP Authorized'] ?? 0;
  document.getElementById('hero-authorized').textContent = authorized;
  document.getElementById('hero-20x').textContent = state.stats.totals.authorized20x;

  // KSI figures inside the explainer copy (counted from the official rules file, not asserted)
  const totalInd = state.ksi.families.reduce((a, f) => a + f.indicators.length, 0);
  document.getElementById('ksi-fam-count').textContent = state.ksi.families.length;
  document.getElementById('ksi-ind-count').textContent = totalInd;
  document.getElementById('ksi-version').textContent = state.ksi.version;

  initKsi(document.getElementById('ksi-panel'), state.ksi);
  const market = document.getElementById('marketplace');
  renderMarket(market);
  initLiveRefresh(market);
}

// citations
const order = wireCitations(document);
renderSourceList(document.getElementById('source-list'), order);
document.getElementById('year').textContent = String(new Date().getFullYear());

boot();
