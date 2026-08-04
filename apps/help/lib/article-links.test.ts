import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Internal-link drift guard for the help centre. Articles cross-link
// heavily (hundreds of /help/... links), and a renamed or recategorised
// article silently 404s every link that pointed at it — the registry
// tests (articles.test.ts) pin slugs to pages, but nothing pinned the
// links INSIDE the pages to real targets until this. Every /help/<path>/
// link in a page.mdx / page.tsx must resolve to an article (page.mdx) or
// a category landing / static page (page.tsx). Links to the rest of the
// product (/new, /explorer, ...) are a different app's routes and stay
// out of scope here.

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

const pageFiles = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx') || p.endsWith('/page.tsx'))
  .concat(existsSync(`${APP_DIR}/page.tsx`) ? ['page.tsx'] : []);

// /help/<path>/ -> <path> (no trailing slash), dropping #anchors and ?query.
// Markdown [label](/help/...) plus JSX href="/help/..." both count.
function helpLinksIn(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:\]\(|href=")(\/help\/[^)"\s]*)/g)) {
    const raw = m[1]!.replace(/[#?].*$/, '');
    out.push(raw.replace(/^\/help\/?/, '').replace(/\/$/, ''));
  }
  return out;
}

function targetExists(path: string): boolean {
  if (path === '') return existsSync(`${APP_DIR}/page.tsx`); // the /help/ home
  return existsSync(`${APP_DIR}/${path}/page.mdx`) || existsSync(`${APP_DIR}/${path}/page.tsx`);
}

describe('help centre internal links', () => {
  it('every /help/... link inside a page resolves to a real page (no dead cross-links)', () => {
    const broken: string[] = [];
    for (const file of pageFiles) {
      const source = readFileSync(`${APP_DIR}/${file}`, 'utf8');
      for (const link of helpLinksIn(source)) {
        if (!targetExists(link)) broken.push(`${file} -> /help/${link}/`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('actually sees the cross-link corpus (guard against a regex gone blind)', () => {
    let total = 0;
    for (const file of pageFiles) {
      total += helpLinksIn(readFileSync(`${APP_DIR}/${file}`, 'utf8')).length;
    }
    // The corpus was ~360 links when this guard landed; if extraction ever
    // collapses toward zero the first assertion passes vacuously, so pin a
    // healthy floor rather than an exact count.
    expect(total).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------
// Links OUT of the help centre, into the editor app
// ---------------------------------------------------------------------

const LIVE_APP_DIR = fileURLToPath(new URL('../../live/app', import.meta.url));

// Routes served by a different worker entirely, so there is no page.tsx to
// find. The router stitches these under the same hostname (spec/08).
const OTHER_WORKERS = new Set(['/telemetry']);

// Markdown [label](/path) and JSX href="/path", excluding /help (covered
// above) and anything absolute.
function productLinksIn(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:\]\(|href=")(\/[a-z][^)"\s]*)/g)) {
    const raw = m[1]!.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (raw.startsWith('/help')) continue;
    out.push(raw);
  }
  return out;
}

function liveRouteExists(path: string): boolean {
  if (OTHER_WORKERS.has(path)) return true;
  const rel = path.replace(/^\//, '');
  if (rel === '') return existsSync(`${LIVE_APP_DIR}/page.tsx`);
  return existsSync(`${LIVE_APP_DIR}/${rel}/page.tsx`);
}

describe('help centre links into the editor', () => {
  it('sees the corpus at all (guard against a regex gone blind)', () => {
    const total = pageFiles.reduce(
      (n, f) => n + productLinksIn(readFileSync(`${APP_DIR}/${f}`, 'utf8')).length,
      0,
    );
    // ~19 when this landed. A collapse to zero would make the next
    // assertion pass without checking anything.
    expect(total).toBeGreaterThan(10);
    // And the route tree must actually be readable from here.
    expect(existsSync(`${LIVE_APP_DIR}/new/page.tsx`)).toBe(true);
  });

  it('every product link resolves to a real editor route', () => {
    const broken: string[] = [];
    for (const file of pageFiles) {
      for (const link of productLinksIn(readFileSync(`${APP_DIR}/${file}`, 'utf8'))) {
        if (!liveRouteExists(link)) broken.push(`${file} -> ${link}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
