import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { articlePath } from '@liveworkspace/help-registry';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { allPageFiles, APP_DIR, articleFile } from '../testing/scoped-articles';

// The catalogue (packages/help-registry) is the SINGLE source for search and browse: an article's page.mdx renders
// from the filesystem but is invisible unless the catalogue lists it, and a listed path with no page is a dead
// search link. One article tree holds every app's articles, so both directions are checked once, over all of them;
// each edition's articles.test.ts checks its own scope's search.
const pagePaths = allPageFiles()
  .filter((f) => f.endsWith('/page.mdx'))
  .map((f) => f.slice(0, -'/page.mdx'.length));

describe('the article tree and the catalogue', () => {
  it('reads the tree (guard against this test going blind)', () => {
    expect(pagePaths.length).toBeGreaterThan(300);
  });

  it('has a page.mdx for every article (no dead search links)', () => {
    expect(
      allArticles.filter((a) => !existsSync(`${APP_DIR}/${articleFile(a)}`)).map(articlePath),
    ).toEqual([]);
  });

  it('lists every article page.mdx (none invisible to search)', () => {
    const listed = new Set(allArticles.map(articlePath));
    expect(pagePaths.filter((p) => !listed.has(p))).toEqual([]);
  });

  it('gives every article search keywords (nothing findable only by exact title)', () => {
    expect(allArticles.filter((a) => !a.keywords.trim()).map(articlePath)).toEqual([]);
  });
});
