import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES, helpArticleHref, helpArticleLeaf } from './help-articles';

// The editor deep-links into the help centre (apps/help) by the slugs in
// HELP_ARTICLES, so a stale slug ships a 404 link. The editor depends on
// help's URL structure at runtime, so reading help's app/ here to confirm
// every link resolves is a legitimate cross-app guard: if help moves an
// article, that link really is broken and this should fail. (Stronger than
// checking against @livediagram/help-registry: the filesystem is what
// actually serves the page.)
const HELP_APP = fileURLToPath(new URL('../../help/app', import.meta.url));

describe('HELP_ARTICLES deep links resolve to a real help page', () => {
  it('every mapped path has a page.mdx (article) or page.tsx (category landing)', () => {
    const missing = Object.entries(HELP_ARTICLES).filter(
      ([, slug]) =>
        !existsSync(`${HELP_APP}/${slug}/page.mdx`) && !existsSync(`${HELP_APP}/${slug}/page.tsx`),
    );
    expect(missing).toEqual([]);
  });
});

describe('helpArticleHref / helpArticleLeaf', () => {
  it('builds an absolute /help path with a trailing slash', () => {
    expect(helpArticleHref('sharing')).toBe('/help/collaboration/sharing/');
  });

  it('returns the slash-free leaf slug for telemetry', () => {
    expect(helpArticleLeaf('shareLinkExpiry')).toBe('share-link-expiry');
    expect(helpArticleLeaf('palette')).toBe('palette'); // single-segment value
  });
});
