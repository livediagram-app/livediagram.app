import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { articles, categories } from '@/lib/articles';

// Retired help articles redirect permanently from public/_redirects (paths without the /help prefix, which
// the router strips). Every target must be a page the app still exports, and no live article or category
// may be redirected away from itself.
const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/) as [string, string, string]);

const pageExists = (path: string) =>
  ['page.mdx', 'page.tsx'].some((file) =>
    existsSync(`${APP_DIR}${path.replace(/\/$/, '')}/${file}`),
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
