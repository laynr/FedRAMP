/**
 * learn.html bootstrap — deliberately dependency-light: citations, countdowns,
 * quiz checkpoints, and the class picker. No data loading; the live numbers
 * live in the tool (index.html), this page teaches the concepts.
 */

import { wireCitations, renderSourceList } from './sources.js';

// ---------- theme (respect the choice made in the tool; storage may be unavailable) ----------
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch { /* private mode etc. — the OS media query still applies */ }

// ---------- countdowns (client-side, same logic as app.js, so dates age gracefully) ----------
const daysUntil = (iso) => Math.ceil((new Date(`${iso}T00:00:00`) - Date.now()) / 86_400_000);
for (const el of document.querySelectorAll('[data-deadline]')) {
  const d = daysUntil(el.dataset.deadline);
  el.textContent =
    d > 1 ? `${el.dataset.what} in ${d} days` :
    d === 1 ? `${el.dataset.what} tomorrow` :
    d === 0 ? `${el.dataset.what} today` :
    `${el.dataset.after} ${-d} days ago`;
  el.classList.toggle('past', d < 0);
}

// ---------- quiz checkpoints ----------
for (const quiz of document.querySelectorAll('.quiz')) {
  const answer = quiz.dataset.answer;
  const explain = quiz.querySelector('.quiz-explain');
  for (const btn of quiz.querySelectorAll('button[data-opt]')) {
    btn.addEventListener('click', () => {
      const right = btn.dataset.opt === answer;
      for (const b of quiz.querySelectorAll('button[data-opt]')) {
        b.disabled = true;
        if (b.dataset.opt === answer) b.classList.add('correct');
      }
      btn.classList.add(right ? 'correct' : 'incorrect');
      explain.hidden = false;
    });
  }
}

// ---------- class picker ----------
const picker = document.getElementById('class-picker');
if (picker) {
  const cards = picker.querySelectorAll('.picker-card');
  for (const btn of picker.querySelectorAll('button[data-pick]')) {
    btn.addEventListener('click', () => {
      for (const b of picker.querySelectorAll('button[data-pick]')) b.classList.remove('active');
      btn.classList.add('active');
      for (const c of cards) c.hidden = c.dataset.card !== btn.dataset.pick;
    });
  }
}

// ---------- citations: superscripts link to this page's numbered list ----------
const order = wireCitations(document);
renderSourceList(document.getElementById('source-list'), order);
