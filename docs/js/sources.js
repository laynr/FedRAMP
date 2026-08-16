/**
 * The citation registry. Every factual claim on the page references one of
 * these by id via <a data-cite="id">. All URLs were individually verified to
 * return 200 on the date below; tools/check-links.mjs re-verifies them.
 * fedramp.gov was restructured in June 2026 — many older URLs now 404, so
 * nothing goes in this list without a live check.
 */

export const VERIFIED = '2026-08-15';

export const SOURCES = {
  'gsa-20x-announce': {
    title: 'GSA announces FedRAMP 20x (press release, Mar 24, 2025)',
    url: 'https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-announces-fedramp-20x-03242025',
  },
  '20x-hub': {
    title: 'FedRAMP 20x hub — phases, status, certification classes',
    url: 'https://www.fedramp.gov/20x/',
  },
  'rules-launch': {
    title: 'FedRAMP launches Consolidated Rules for 2026 (blog, Jun 25, 2026)',
    url: 'https://www.fedramp.gov/2026-06-25-propelling-change-fedramp-launches-consolidated-rules-for-2026/',
  },
  'rules-2026': {
    title: 'FedRAMP Consolidated Rules for 2026 (official ruleset)',
    url: 'https://www.fedramp.gov/2026/',
  },
  definitions: {
    title: 'FedRAMP 2026 official definitions (incl. certification classes)',
    url: 'https://www.fedramp.gov/2026/definitions/',
  },
  reference: {
    title: 'FedRAMP 2026 ruleset reference (per-class rules and KSIs)',
    url: 'https://www.fedramp.gov/2026/reference/',
  },
  rfcs: {
    title: 'FedRAMP RFC index (community rulemaking record)',
    url: 'https://www.fedramp.gov/rfcs/',
  },
  'rfc-0006': {
    title: 'RFC-0006 — Key Security Indicators standard (adopted May 2025)',
    url: 'https://www.fedramp.gov/rfcs/0006/',
  },
  'rfc-0023': {
    title: 'RFC-0023 — FedRAMP certifications without an agency sponsor (adopted Feb 2026)',
    url: 'https://www.fedramp.gov/rfcs/0023/',
  },
  'm-24-15': {
    title: 'OMB Memorandum M-24-15, Modernizing FedRAMP (Jul 2024)',
    url: 'https://www.fedramp.gov/2026/authority/m-24-15/',
  },
  law: {
    title: 'FedRAMP Authorization Act, 44 U.S.C. §§ 3607–3616 (2022)',
    url: 'https://www.fedramp.gov/2026/authority/law/',
  },
  'gsa-milestones': {
    title: 'GSA celebrates major FedRAMP milestones (press release, Aug 11, 2025)',
    url: 'https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-celebrates-major-fedramp-milestones-08112025',
  },
  playbook: {
    title: 'FedRAMP Agency Authorization Playbook v4.1 (PDF, Nov 2025)',
    url: 'https://www.fedramp.gov/resources/documents/Agency_Authorization_Playbook.pdf',
  },
  'rev5-deck': {
    title: 'FedRAMP Rev-5 Transition Overview (official deck; baseline control counts)',
    url: 'https://www.fedramp.gov/resources/documents/Rev-5-Transition-Overview-Presentation.pdf',
  },
  'legacy-playbook': {
    title: 'FedRAMP legacy playbook — agency authorization path',
    url: 'https://www.fedramp.gov/legacy/playbook/csp/authorization/agency-authorization-path/',
  },
  marketplace: {
    title: 'FedRAMP Marketplace',
    url: 'https://marketplace.fedramp.gov/',
  },
  'mkt-data': {
    title: 'FedRAMP/marketplace-fedramp-gov-data — the official data feed behind the Marketplace (GSA, updated ~daily)',
    url: 'https://github.com/FedRAMP/marketplace-fedramp-gov-data',
  },
  'rules-repo': {
    title: 'FedRAMP/rules — the Consolidated Rules in machine-readable JSON',
    url: 'https://github.com/FedRAMP/rules',
  },
  'blog-4months': {
    title: 'FedRAMP 20x: four months in and authorizing (blog, Jul 30, 2025)',
    url: 'https://www.fedramp.gov/2025-07-30-fedramp-20x-four-months-in-and-authorizing/',
  },
  'vanta-cost': {
    title: 'Vanta — FedRAMP cost estimates (vendor figures, not official)',
    url: 'https://www.vanta.com/collection/fedramp/fedramp-cost',
  },
  'secureframe-cost': {
    title: 'Secureframe — FedRAMP cost estimates (vendor figures, not official)',
    url: 'https://secureframe.com/hub/fedramp/costs',
  },
};

/* Local escaper. Deliberately NOT imported from ui.js: this module is also
   imported by Node (CI's data-cite consistency check), and ui.js touches
   browser globals (matchMedia) at module top level. */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Replace every <a data-cite> with a numbered superscript link; return the
 * ordered list of source ids used (first-appearance order = the numbering).
 *
 * If the page has its own `#source-list` (learn.html), superscripts link to
 * the matching `#src-N` anchor in that list, so the number a reader clicks is
 * the number they land on. Pages without a local list (index.html's drawer)
 * link straight to the external source; the tooltip carries the source title
 * so the number needs no cross-page decoder ring.
 */
export function wireCitations(root = document) {
  const doc = root.ownerDocument ?? root;
  const hasLocalList = Boolean(doc.getElementById && doc.getElementById('source-list'));
  const order = [];
  for (const a of root.querySelectorAll('a[data-cite]')) {
    const id = a.dataset.cite;
    // Own-key lookup only: data-cite comes from the DOM, and a plain-object
    // read of "constructor" would yield a truthy non-source.
    const src = Object.hasOwn(SOURCES, id) ? SOURCES[id] : null;
    if (!src) {
      console.error(`unknown citation id: ${id}`);
      continue;
    }
    if (!order.includes(id)) order.push(id);
    const n = order.indexOf(id) + 1;
    if (hasLocalList) {
      a.href = `#src-${n}`;
    } else {
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.className = 'cite';
    a.title = src.title;
    a.textContent = `[${n}]`;
  }
  return order;
}

/** Render a numbered source list (ids in citation order) into a container. */
export function renderSourceList(el, order) {
  el.innerHTML = order
    .map((id, i) => {
      const s = SOURCES[id];
      return `<li id="src-${i + 1}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span class="src-url">${esc(s.url)}</span></li>`;
    })
    .join('');
}
