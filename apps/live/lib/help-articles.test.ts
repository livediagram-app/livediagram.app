import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

describe('every key earns its place', () => {
  // spec/56 pairs the two halves: "new placements reuse HelpArticleLink + a
  // HELP_ARTICLES key". A key with no surface is half a placement — it looks
  // like the editor links that article when nothing does, and the existing
  // test above passes happily because the PATH is fine.
  //
  // Six had accumulated. Four (mind maps, lanes, entities, the Behaviour
  // category) never had a placement in spec/56 at all. Two more (the Explorer
  // panel, reverting changes) lost theirs when the floating panels' header
  // help icons were deliberately removed, which spec/56 records. Every one of
  // those articles is still in the help centre; only the editor's unused
  // constants went.
  //
  // Matching on the key as a QUOTED STRING is deliberate. Surfaces spell it
  // three ways — `article="x"`, `article: 'x'` in the Explorer's pane config,
  // and `article={cond ? 'x' : 'y'}` — so keying off the prop name would miss
  // one, and matching a bare identifier lets an unrelated word vouch for a
  // key: `lanes` is also a palette category id, which is exactly how it sat
  // here unused. A coincidental quoted string elsewhere could still vouch for
  // a dead key, but that failure is silent and cheap, where a false failure
  // would block an honest change.
  it('is referenced by at least one surface outside the map', () => {
    const SRC = fileURLToPath(new URL('..', import.meta.url));
    const skip = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo']);
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !full.endsWith('lib/help-articles.ts')) {
          sources.push(readFileSync(full, 'utf8'));
        }
      }
    };
    walk(SRC);
    const haystack = sources.join('\n');
    // Guard against the walk finding nothing, which would pass vacuously.
    expect(sources.length).toBeGreaterThan(200);

    const orphans = Object.keys(HELP_ARTICLES).filter(
      (key) => !new RegExp(`['"]${key}['"]`).test(haystack),
    );
    expect(orphans).toEqual([]);
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
