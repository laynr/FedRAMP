/** Shared UI helpers: drawers, count-up animation, safe storage, small utils. */

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * localStorage guard. Safari private mode (and some embedded contexts) throws
 * on ANY localStorage access — even reading `window.localStorage` itself.
 * get() returns null on failure; set()/remove() return false on failure.
 */
export const storage = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); return true; } catch { return false; }
  },
  remove(k) {
    try { localStorage.removeItem(k); return true; } catch { return false; }
  },
};

const backdrop = () => document.getElementById('drawer-backdrop');
const drawers = () => [document.getElementById('explainer'), document.getElementById('svc-drawer')];

// Pending close-finalizer tokens, per drawer element. A reopen (or a newer
// close) invalidates the older finalizer so it can't hide a live drawer.
const closing = new WeakMap();

const DRAWER_EXIT_MS = 240;

export function openDrawer(el) {
  closeDrawers();
  closing.delete(el); // cancel any in-flight close for this drawer
  el.hidden = false;
  backdrop().hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
}

export function closeDrawers() {
  for (const el of drawers()) {
    if (!el) continue;
    const wasOpen = el.classList.contains('open') && !el.hidden;
    el.classList.remove('open');
    if (REDUCED || !wasOpen) {
      closing.delete(el);
      el.hidden = true;
      continue;
    }
    // Let the exit transition play; set hidden after transitionend, with a
    // timeout backstop in case the transition never fires.
    const token = Symbol('drawer-close');
    closing.set(el, token);
    const finish = () => {
      el.removeEventListener('transitionend', finish);
      if (closing.get(el) === token) {
        closing.delete(el);
        el.hidden = true;
      }
    };
    el.addEventListener('transitionend', finish);
    setTimeout(finish, DRAWER_EXIT_MS + 60);
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

/** Missing-data-honest formatter: nullish or non-numeric → em dash. */
export const fmtOrDash = (n) => {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isNaN(num) ? '—' : num.toLocaleString('en-US');
};
