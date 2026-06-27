import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { articles, categories } from './articles';

// The help registry (articles.ts) is hand-maintained and is the SINGLE
// source for search + browse: an article's page.mdx renders from the
// filesystem but is invisible unless it's registered here, and a
// registered slug with no page yields a dead search-result link
// (CLAUDE.md treats either drift as a bug). This pins both directions
// plus the per-category articleCount, so the registry can't silently
// drift from app/.

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

// Every article page lives at app/<categorySlug>/<slug>/page.mdx. Category
// landing pages are page.tsx, so only nested page.mdx files are articles.
const pagePaths = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx'))
  .map((p) => p.slice(0, -'/page.mdx'.length));

const registryPaths = articles.map((a) => `${a.categorySlug}/${a.slug}`);

describe('help article registry', () => {
  it('registers a page.mdx for every article (no dead search links)', () => {
    const pages = new Set(pagePaths);
    const missing = registryPaths.filter((p) => !pages.has(p));
    expect(missing).toEqual([]);
  });

  it('registers every article page.mdx (none invisible to search)', () => {
    const registered = new Set(registryPaths);
    const unregistered = pagePaths.filter((p) => !registered.has(p));
    expect(unregistered).toEqual([]);
  });

  it('has no duplicate registry entries', () => {
    expect(registryPaths.length).toBe(new Set(registryPaths).size);
  });

  it('keeps each category articleCount in sync with its direct articles', () => {
    const declared = Object.fromEntries(categories.map((c) => [c.slug, c.articleCount]));
    const actual: Record<string, number> = {};
    for (const a of articles) {
      // articleCount counts the category's own (direct) articles, i.e. those
      // whose categorySlug is exactly the category slug (not nested sub-cats).
      if (a.categorySlug in declared) actual[a.categorySlug] = (actual[a.categorySlug] ?? 0) + 1;
    }
    const normalisedActual = Object.fromEntries(
      categories.map((c) => [c.slug, actual[c.slug] ?? 0]),
    );
    expect(normalisedActual).toEqual(declared);
  });
});
