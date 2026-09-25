import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { articles } from './articles';

// An article carries two descriptions and they are deliberately different
// jobs. The registry one is the search card's summary: it sits under the
// title in a result list and in the category browse grid, so it wants to be
// short and scannable. The page's `helpMetadata` one is the SEO and OG meta:
// it is what a search engine and a link preview quote, so it wants to say
// more than the card does. CLAUDE.md states the rule directly ("write a
// concise one, don't just copy the meta"), and the Privacy Policy is the
// pattern to copy: a one-line card, a meta that names what the page covers.
//
// Copying one into the other costs nothing visible, which is exactly why it
// is easy to do and hard to notice: the card still renders and the page
// still has a meta tag. Terms of Service had the same sentence in both
// until this test was written.

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

const normalise = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[“”‘’"']/g, '')
    .trim()
    .toLowerCase();

// Pull the `description` out of the page's helpMetadata({ ... }) call. The
// value is a single or multi-line string literal, so read to the `path:` key
// that always follows it and strip the quoting.
const metaDescription = (categorySlug: string, slug: string): string | null => {
  const source = readFileSync(`${APP_DIR}/${categorySlug}/${slug}/page.mdx`, 'utf8');
  const block = source.match(/helpMetadata\(\{[\s\S]*?description:\s*([\s\S]*?),\s*path:/);
  const value = block?.[1];
  if (value === undefined) return null;
  return value
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/['"`]\s*\+?\s*\n\s*['"`]/g, '');
};

describe('help article descriptions', () => {
  it('reads both sides (guard against this test going blind)', () => {
    const read = articles.filter((a) => metaDescription(a.categorySlug, a.slug) !== null);
    expect(read.length).toBe(articles.length);
  });

  it('never reuses the search-card summary as the page meta', () => {
    const copied = articles
      .filter((a) => {
        const meta = metaDescription(a.categorySlug, a.slug);
        return meta !== null && normalise(meta) === normalise(a.description);
      })
      .map((a) => `${a.categorySlug}/${a.slug}`);
    expect(copied).toEqual([]);
  });
});
