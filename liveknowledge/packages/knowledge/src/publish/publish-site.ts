// The pages of a public site (docs/specs/030-knowledgebase/publishing.md "The public site", blueprint P12, P15, P16
// and P22): a published page with its tree, breadcrumb and Previous and Next; the search page; the not found page.
// Everything is built from the published snapshot's own fields and escaped here; no script is ever written.
import { escapeHtml } from './publish-writing';
import { siteCss, type SiteLook } from './publish-site-css';

/** A page of the site's tree, by address; the first is the front page. */
export type SiteTreeEntry = {
  address: string;
  title: string;
  icon: string | null;
  /** The parent page's address; null at the top. */
  parent: string | null;
};

export type SiteView = {
  /** The origin the site is read at (`https://www.liveknowledge.app`), for canonical and social addresses. */
  origin: string;
  address: string;
  name: string;
  noindex: boolean;
  look: SiteLook;
  tree: SiteTreeEntry[];
};

export type SitePage = {
  address: string;
  title: string;
  icon: string | null;
  html: string;
  description: string;
  savedAt: number;
  /** The names of the people who wrote it, only when the site shows them. */
  writers: string[];
};

export type SiteSearchResult = { address: string; title: string; snippet: string };

export const UNTITLED_PAGE = 'Untitled Page';
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A site's path: its front page, a page, or one of its own routes. */
export function sitePath(site: string, page: string | null = null): string {
  return page === null ? `/kb/${site}` : `/kb/${site}/${page}`;
}

/** The path of a page of the tree: the front page is the site's own. */
export const pagePath = (view: Pick<SiteView, 'address' | 'tree'>, address: string): string =>
  view.tree[0]?.address === address ? sitePath(view.address) : sitePath(view.address, address);

/** A date as the site words it, in UTC: "21 November 2026". */
export function siteDate(at: number): string {
  const d = new Date(at);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const titleOf = (title: string) => title.trim() || UNTITLED_PAGE;

/** A list of names as the site says it: "Ana", "Ana and Ben", "Ana, Ben and Cai". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

type Head = { title: string; description: string; canonical: string; image: string | null };

function head(view: SiteView, h: Head): string {
  const e = escapeHtml;
  const robots = view.noindex ? '<meta name="robots" content="noindex, nofollow">' : '';
  const image = h.image
    ? `<meta property="og:image" content="${e(h.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${e(h.image)}">`
    : '';
  const fonts = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${e(view.look.fontsHref)}">`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(h.title)}</title><meta name="description" content="${e(h.description)}">${robots}
<link rel="canonical" href="${e(h.canonical)}"><meta name="color-scheme" content="light dark">
<meta property="og:type" content="article"><meta property="og:site_name" content="${e(view.name)}"><meta property="og:title" content="${e(h.title)}"><meta property="og:description" content="${e(h.description)}"><meta property="og:url" content="${e(h.canonical)}">${image}
<meta name="twitter:card" content="${h.image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${e(h.title)}"><meta name="twitter:description" content="${e(h.description)}">
${fonts}<style>${siteCss(view.look)}</style></head>`;
}

function header(view: SiteView, query = ''): string {
  const e = escapeHtml;
  return `<input type="checkbox" id="pages-toggle" class="pages-toggle" aria-label="Show the pages">
<header class="head"><a class="skip" href="#main">Skip to the page</a>
<label for="pages-toggle" class="pages-button">Pages</label>
<a class="brand" href="${e(sitePath(view.address))}">${e(view.name)}</a>
<form class="search" role="search" method="get" action="${e(sitePath(view.address, 'search'))}"><input type="search" name="q" value="${e(query)}" placeholder="Search" aria-label="Search ${e(view.name)}" maxlength="200"></form>
</header>`;
}

// The tree as nested lists: a page with subpages is a disclosure, open on the way to the current page.
function tree(view: SiteView, current: string | null): string {
  const children = new Map<string | null, SiteTreeEntry[]>();
  for (const entry of view.tree) {
    const list = children.get(entry.parent) ?? [];
    list.push(entry);
    children.set(entry.parent, list);
  }
  const onPath = new Set<string>();
  const byAddress = new Map(view.tree.map((t) => [t.address, t]));
  for (let at = current; at !== null; at = byAddress.get(at)?.parent ?? null) {
    if (onPath.has(at)) break;
    onPath.add(at);
  }
  const e = escapeHtml;
  const list = (parent: string | null, depth: number): string => {
    const items = (children.get(parent) ?? []).map((entry) => {
      const label = `${entry.icon ? `${e(entry.icon)} ` : ''}${e(titleOf(entry.title))}`;
      const link = `<a href="${e(pagePath(view, entry.address))}"${entry.address === current ? ' aria-current="page"' : ''}>${label}</a>`;
      const below = depth < 8 && children.has(entry.address) ? list(entry.address, depth + 1) : '';
      return below
        ? `<li><details${onPath.has(entry.address) ? ' open' : ''}><summary>${link}</summary>${below}</details></li>`
        : `<li>${link}</li>`;
    });
    return `<ul>${items.join('')}</ul>`;
  };
  return `<nav class="side" aria-label="Pages">${list(null, 1)}</nav>`;
}

const footer = () =>
  '<footer class="foot">Published with <a href="https://www.liveknowledge.app" rel="noopener">liveknowledge</a></footer>';

/** A published page, whole. */
export function renderSitePage(view: SiteView, page: SitePage): string {
  const e = escapeHtml;
  const title = titleOf(page.title);
  const front = view.tree[0]?.address === page.address;
  const path = pagePath(view, page.address);
  const byAddress = new Map(view.tree.map((t) => [t.address, t]));
  const crumbs: SiteTreeEntry[] = [];
  for (let at = byAddress.get(page.address)?.parent ?? null; at !== null;) {
    const entry = byAddress.get(at);
    if (!entry || crumbs.includes(entry)) break;
    crumbs.unshift(entry);
    at = entry.parent;
  }
  const at = view.tree.findIndex((t) => t.address === page.address);
  const previous = at > 0 ? view.tree[at - 1] : undefined;
  const next = at >= 0 ? view.tree[at + 1] : undefined;
  const pager =
    previous || next
      ? `<nav class="pager" aria-label="Previous and next pages">${
          previous
            ? `<a class="previous" href="${e(pagePath(view, previous.address))}"><span>Previous</span>${e(titleOf(previous.title))}</a>`
            : ''
        }${
          next
            ? `<a class="next" href="${e(pagePath(view, next.address))}"><span>Next</span>${e(titleOf(next.title))}</a>`
            : ''
        }</nav>`
      : '';
  const meta = [
    `Updated ${siteDate(page.savedAt)}`,
    ...(page.writers.length ? [`Written by ${namesList(page.writers)}`] : []),
  ].join(' · ');
  const docTitle = front && title === view.name ? view.name : `${title} · ${view.name}`;
  return `${head(view, {
    title: docTitle,
    description: page.description || view.name,
    canonical: `${view.origin}${path}`,
    image: `${view.origin}/opengraph-image`,
  })}<body>${header(view)}<div class="layout">${tree(view, page.address)}
<main id="main"><article class="column">${
    crumbs.length
      ? `<ol class="crumbs" aria-label="Breadcrumb">${crumbs.map((c) => `<li><a href="${e(pagePath(view, c.address))}">${e(titleOf(c.title))}</a></li>`).join('')}</ol>`
      : ''
  }${page.icon ? `<p class="icon" aria-hidden="true">${e(page.icon)}</p>` : ''}<h1>${e(title)}</h1>
<p class="meta">${e(meta)}</p>${page.html}${pager}</article></main></div>${footer()}</body></html>`;
}

// FTS5's marks around a matched word (sql/search.ts MATCH_START and MATCH_END): a <mark>, everything else escaped.
function markedHtml(text: string): string {
  let out = '';
  for (const c of text) {
    if (c === '\u0002') out += '<mark>';
    else if (c === '\u0003') out += '</mark>';
    else out += escapeHtml(c);
  }
  return out;
}

/** The search page: what was asked, and the published pages that match. */
export function renderSiteSearch(
  view: SiteView,
  query: string,
  results: readonly SiteSearchResult[],
): string {
  const e = escapeHtml;
  const asked = query.trim();
  const body = !asked
    ? '<p>Type a word to search these pages.</p>'
    : results.length === 0
      ? `<p>No page matches “${e(asked)}”.</p><p><a href="${e(sitePath(view.address))}">Back to the front page</a></p>`
      : `<ol class="results">${results
          .map(
            (r) =>
              `<li><a href="${e(pagePath(view, r.address))}">${e(titleOf(r.title))}</a>${r.snippet ? `<p>${markedHtml(r.snippet)}</p>` : ''}</li>`,
          )
          .join('')}</ol>`;
  const title = asked ? `Search: ${asked} · ${view.name}` : `Search · ${view.name}`;
  return `${head(view, {
    title,
    description: `Search ${view.name}`,
    canonical: `${view.origin}${sitePath(view.address, 'search')}`,
    image: null,
  })}<body>${header(view, query)}<div class="layout">${tree(view, null)}
<main id="main"><div class="column"><h1>Search</h1>${body}</div></main></div>${footer()}</body></html>`;
}

/** The page for an address that holds nothing: it names no knowledgebase. */
export function renderSiteNotFound(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page Not Found</title><meta name="color-scheme" content="light dark"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-sans-serif,system-ui,sans-serif;background:#fff;color:#0f172a;padding:16px}
@media (prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}a{color:#a3e635}}
a{color:#4d7c0f}main{max-width:28rem;text-align:center}h1{font-size:1.6rem;margin:0 0 .5rem}p{color:#64748b}
</style></head><body><main><h1>Page Not Found</h1><p>This page isn't published, or the address has changed.</p><p><a href="https://www.liveknowledge.app">liveknowledge</a></p></main></body></html>`;
}
