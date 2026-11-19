import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  articleHref,
  articles,
  categoryHref,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
} from '@/lib/articles';
import { APP_DIR, articleFile } from '@/lib/testing/scoped-articles';

// The scope's view of the one catalogue (packages/help-registry, re-exported by @/lib/articles), which is the SINGLE
// source for this app's search and browse. The article tree and the catalogue are pinned to each other once, over
// every app, in lib/guards/pages-registry.test.ts; this checks the scope's own articles and its search.

describe('help article registry', () => {
  it('has a page.mdx for every article in this scope (no dead search links)', () => {
    const missing = articles.filter((a) => !existsSync(`${APP_DIR}/${articleFile(a)}`));
    expect(missing.map((a) => `${a.categorySlug}/${a.slug}`)).toEqual([]);
  });

  it('has no duplicate registry entries', () => {
    const paths = articles.map((a) => `${a.categorySlug}/${a.slug}`);
    expect(paths.length).toBe(new Set(paths).size);
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

  it('finds an article holding every word of a query, wherever they sit', () => {
    const titles = searchArticles('export png').map((a) => a.title);
    expect(titles).toContain('Exporting Documents');
    // Every word must be there: a word no article holds finds nothing.
    expect(searchArticles('export zzqqxx')).toEqual([]);
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

  it('ranks title matches ahead of description and keyword matches (liveworkspace/docs/specs/016-help/help-centre.md "Search")', () => {
    const inTitle = searchArticles('share').map((a) => a.title.toLowerCase().includes('share'));
    expect(inTitle.indexOf(false)).toBeGreaterThan(inTitle.lastIndexOf(true));
    // A title that starts with the query leads.
    expect(searchArticles('keyboard')[0]!.title.toLowerCase().startsWith('keyboard')).toBe(true);
  });

  it('returns everything for an empty query and nothing for a non-match', () => {
    expect(searchArticles('')).toHaveLength(articles.length);
    expect(searchArticles('zzz-no-such-help-content-xyz')).toEqual([]);
  });
});
