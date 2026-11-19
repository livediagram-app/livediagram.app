import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_DIR, readScoped, scopedPageFiles } from './scoped-articles';

// The link checks every edition runs over the pages its scope shows (scoped-articles.ts), each page read as the scope
// reads it (other apps' notes dropped). Articles cross-link heavily, and a renamed or recategorised article silently
// 404s every link that pointed at it: every /help/<path>/ link must resolve to an article (page.mdx) or a landing or
// fixed page (page.tsx) of the one help centre. Links to the rest of the product (/new, /explorer, ...) are its
// editor's routes, so they must resolve to a page of that editor.

// Routes served by a different Worker entirely, so there is no page.tsx to find. The router stitches these under the
// same hostname. The Explorer is liveworkspace's page, which the router serves at /explorer/* with the address kept
// (liveworkspace/docs/specs/004-index/one-explorer.md), so the editor has no page for it.
const OTHER_WORKERS = new Set(['/telemetry', '/community']);
const OTHER_WORKER_PREFIXES = ['/explorer'];

/** /help/<path>/ links in Markdown [label](/help/...) or JSX href="/help/...", as `<path>` with no slashes, anchors
 *  or query. */
export function helpLinksIn(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:\]\(|href=")(\/help\/[^)"\s]*)/g)) {
    const raw = m[1]!.replace(/[#?].*$/, '');
    out.push(raw.replace(/^\/help\/?/, '').replace(/\/$/, ''));
  }
  return out;
}

/** Links to the product's own routes ([label](/path), href="/path"), /help ones and absolute ones left out. */
export function productLinksIn(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:\]\(|href=")(\/[a-z][^)"\s]*)/g)) {
    const raw = m[1]!.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (raw.startsWith('/help')) continue;
    out.push(raw);
  }
  return out;
}

function helpTargetExists(path: string): boolean {
  if (path === '') return existsSync(`${APP_DIR}/page.tsx`);
  return existsSync(`${APP_DIR}/${path}/page.mdx`) || existsSync(`${APP_DIR}/${path}/page.tsx`);
}

export function describeArticleLinks({
  editorAppDir,
  helpLinkFloor,
  productLinkFloor = 10,
}: {
  /** The product's editor's Next app/ folder, whose page.tsx files are its routes. */
  editorAppDir: string;
  /** The fewest /help links the scope's pages hold: a guard against a regex gone blind. */
  helpLinkFloor: number;
  productLinkFloor?: number;
}) {
  const pages = scopedPageFiles().map((file) => ({ file, source: readScoped(file) }));

  describe('help centre internal links', () => {
    it('every /help/... link inside a page resolves to a real page (no dead cross-links)', () => {
      const broken = pages.flatMap(({ file, source }) =>
        helpLinksIn(source)
          .filter((link) => !helpTargetExists(link))
          .map((link) => `${file} -> /help/${link}/`),
      );
      expect(broken).toEqual([]);
    });

    it('actually sees the cross-link corpus (guard against a regex gone blind)', () => {
      expect(pages.reduce((n, p) => n + helpLinksIn(p.source).length, 0)).toBeGreaterThan(
        helpLinkFloor,
      );
    });
  });

  const liveRouteExists = (path: string): boolean => {
    if (OTHER_WORKERS.has(path)) return true;
    if (OTHER_WORKER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
    const rel = path.replace(/^\//, '');
    if (rel === '') return existsSync(`${editorAppDir}/page.tsx`);
    return existsSync(`${editorAppDir}/${rel}/page.tsx`);
  };

  describe('help centre links into the editor', () => {
    it('sees the corpus at all (guard against a regex gone blind)', () => {
      expect(pages.reduce((n, p) => n + productLinksIn(p.source).length, 0)).toBeGreaterThan(
        productLinkFloor,
      );
      // And the route tree must actually be readable from here.
      expect(existsSync(`${editorAppDir}/new/page.tsx`)).toBe(true);
    });

    it('every product link resolves to a real editor route', () => {
      const broken = pages.flatMap(({ file, source }) =>
        productLinksIn(source)
          .filter((link) => !liveRouteExists(link))
          .map((link) => `${file} -> ${link}`),
      );
      expect(broken).toEqual([]);
    });
  });
}
