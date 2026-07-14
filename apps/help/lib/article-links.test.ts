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
