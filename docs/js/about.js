/**
 * about.html: render the FULL citation registry in canonical order and stamp
 * the verification date from the single source of truth (sources.js VERIFIED)
 * everywhere the page mentions it.
 */

import { SOURCES, VERIFIED, renderSourceList } from './sources.js';

// Canonical order = registry declaration order (stable across pages).
renderSourceList(document.getElementById('source-list'), Object.keys(SOURCES));

for (const el of document.querySelectorAll('.verified-date')) {
  el.textContent = VERIFIED;
}

// Respect the theme chosen in the tool (guarded: storage may be unavailable).
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch { /* private mode etc. — media query fallback still applies */ }
