import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  articleHref,
  articles,
  categories,
  categoryHref,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
} from './articles';

// The help registry (packages/help-registry, re-exported here) is
// hand-maintained and is the SINGLE source for search + browse: an
// article's page.mdx renders from the filesystem but is invisible unless
// it's registered there, and a registered slug with no page yields a dead
// search-result link (CLAUDE.md treats either drift as a bug). This pins
// both directions plus the per-category articleCount, so the registry
// can't silently drift from app/. The filesystem checks live in this app
// (not the package) because they read this app's app/ directory.

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

  it('gives every article search keywords (nothing findable only by exact title)', () => {
    const missing = articles.filter((a) => !a.keywords.trim());
    expect(missing.map((a) => a.slug)).toEqual([]);
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

describe('href builders', () => {
  it('builds trailing-slash paths', () => {
    expect(categoryHref('explorer')).toBe('/explorer/');
    expect(articleHref({ categorySlug: 'canvas', slug: 'themes' })).toBe('/canvas/themes/');
  });
});

describe('getArticlesByCategory', () => {
  it('returns exactly the articles in that category', () => {
    const slug = articles[0]!.categorySlug;
    const got = getArticlesByCategory(slug);
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((a) => a.categorySlug === slug)).toBe(true);
    expect(getArticlesByCategory('no-such-category')).toEqual([]);
  });
});

describe('getCategoryGroups', () => {
  it('partitions a category without losing or duplicating articles', () => {
    const slug = articles[0]!.categorySlug;
    const groups = getCategoryGroups(slug);
    const flat = groups.flatMap((g) => g.articles);
    expect(flat).toEqual(getArticlesByCategory(slug)); // same items, same order
    expect(new Set(groups.map((g) => g.group)).size).toBe(groups.length); // no dup group labels
  });
});

describe('getSubArticles', () => {
  it('returns the children of a parent slug', () => {
    const child = articles.find((a) => a.parentSlug);
    expect(child).toBeDefined();
    const subs = getSubArticles(child!.parentSlug!);
    expect(subs).toContain(child);
    expect(subs.every((a) => a.parentSlug === child!.parentSlug)).toBe(true);
    expect(getSubArticles('no-such-parent')).toEqual([]);
  });
});

describe('searchArticles', () => {
  it('matches case-insensitively on title, description, or keywords', () => {
    const first = articles[0]!;
    const word = first.title.split(' ')[0]!;
    const hits = searchArticles(word);
    expect(hits).toContain(first);
    const lower = word.toLowerCase();
    expect(
      hits.every((a) => `${a.title} ${a.description} ${a.keywords}`.toLowerCase().includes(lower)),
    ).toBe(true);
    // Case-insensitive: upper and lower queries return the same set.
    expect(searchArticles(word.toUpperCase())).toEqual(searchArticles(word.toLowerCase()));
  });

  it('finds articles by keyword synonym, not just title (the "opacity" report)', () => {
    // "transparency" appears in no title or description; keywords carry it to
    // both opacity articles.
    const slugs = searchArticles('transparency').map((a) => a.slug);
    expect(slugs).toContain('layer-order');
    expect(slugs).toContain('panel-opacity');
    // "hotkey" -> the keyboard-shortcuts article.
    expect(searchArticles('hotkey').map((a) => a.slug)).toContain('keyboard-shortcuts');
  });

  it('returns everything for an empty query and nothing for a non-match', () => {
    expect(searchArticles('')).toHaveLength(articles.length);
    expect(searchArticles('zzz-no-such-help-content-xyz')).toEqual([]);
  });
});
