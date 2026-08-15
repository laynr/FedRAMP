/** Shared UI helpers: drawers, count-up animation, small utils. */

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const backdrop = () => document.getElementById('drawer-backdrop');
const drawers = () => [document.getElementById('explainer'), document.getElementById('svc-drawer')];

export function openDrawer(el) {
  closeDrawers();
  el.hidden = false;
  backdrop().hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
}

export function closeDrawers() {
  for (const el of drawers()) {
    el.classList.remove('open');
    el.hidden = true;
  }
  backdrop().hidden = true;
}

export function countUp(el, target, { duration = 800, format = (v) => Math.round(v).toLocaleString('en-US') } = {}) {
  if (REDUCED || !target) {
    el.textContent = format(target ?? 0);
    return;
  }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    el.textContent = format(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');
