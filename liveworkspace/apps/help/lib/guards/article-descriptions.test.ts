import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { articlePath } from '@liveworkspace/help-registry';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { APP_DIR, articleFile } from '../testing/scoped-articles';

// An article carries two descriptions and they are deliberately different jobs. The catalogue's is the search
// card's summary: it sits under the title in a result list and in the category grid, so it wants to be short and
// scannable. The page's `helpMetadata` one is the SEO and OG meta: what a search engine and a link preview quote,
// so it wants to say more than the card does ("write a concise one, don't just copy the meta"). Copying one into the
// other costs nothing visible, which is why it is easy to do and hard to notice; the old Terms of Use article had the
// same sentence in both until this test was written. The MDX's meta is the shared one, so it is checked once, against
// each article's shared card summary.

const normalise = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[“”‘’"']/g, '')
    .trim()
    .toLowerCase();

// The `description` of the page's helpMetadata({ ... }) call: a single or multi-line string literal, read to the
// `path:` key that always follows it, with its quoting stripped.
const metaDescription = (article: { categorySlug: string; slug: string }): string | null => {
  const source = readFileSync(`${APP_DIR}/${articleFile(article)}`, 'utf8');
  const value = source.match(/helpMetadata\(\{[\s\S]*?description:\s*([\s\S]*?),\s*path:/)?.[1];
  if (value === undefined) return null;
  return value
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/['"`]\s*\+?\s*\n\s*['"`]/g, '');
};

describe('help article descriptions', () => {
  it('reads both sides (guard against this test going blind)', () => {
    expect(allArticles.filter((a) => metaDescription(a) === null).map(articlePath)).toEqual([]);
  });

  it('never reuses the search-card summary as the page meta', () => {
    const copied = allArticles
      .filter((a) => {
        const meta = metaDescription(a);
        return meta !== null && normalise(meta) === normalise(a.description);
      })
      .map(articlePath);
    expect(copied).toEqual([]);
  });
});
