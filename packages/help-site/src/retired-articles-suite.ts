import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { HelpSite } from './site';

// Retired help articles redirect permanently from the app's public/_redirects (paths without the /help prefix,
// which the router strips). Written once and run by every help app that retires an article (its
// lib/retired-articles.test.ts): every target must be a page the app still exports, and no live article or
// category may be redirected away from itself.

export interface RetiredArticlesSuiteOptions {
  /** The app's `app/` folder, where each redirect's target must still have a page. */
  appDir: string;
  /** The app's public/_redirects file. */
  redirectsFile: string;
}

export function describeRetiredArticles(
  site: HelpSite,
  { appDir, redirectsFile }: RetiredArticlesSuiteOptions,
) {
  const { articles, categories } = site.catalogue;
  const rules = readFileSync(redirectsFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/) as [string, string, string]);

  const pageExists = (path: string) =>
    ['page.mdx', 'page.tsx'].some((file) =>
      existsSync(`${appDir}${path.replace(/\/$/, '')}/${file}`),
    );

  const livePaths = new Set([
    ...categories.map((c) => `/${c.slug}`),
    ...articles.map((a) => `/${a.categorySlug}/${a.slug}`),
  ]);

  describe('retired help articles', () => {
    it('has rules to check', () => {
      expect(rules.length).toBeGreaterThan(0);
    });

    it.each(rules)('%s redirects permanently to a live page', (from, to, status) => {
      expect(status).toBe('301');
      expect(to.endsWith('/'), to).toBe(true);
      expect(pageExists(to), to).toBe(true);
      expect(from.startsWith('/help/'), from).toBe(false);
    });

    it.each(rules)('%s is not a live article or category', (from) => {
      const path = from.replace(/\/\*$/, '').replace(/\/$/, '');
      expect(livePaths.has(path), path).toBe(false);
      expect(pageExists(path), path).toBe(false);
    });
  });
}
