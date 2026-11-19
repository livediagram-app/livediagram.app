import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HELP_ARTICLES,
  HELP_LINK_COPY,
  helpArticleHref,
  helpArticleTelemetryId,
  type HelpArticleKey,
} from './help-articles';
import { articles, categories } from '@livedesign/help-registry';

// The editor deep-links into the help centre by the paths in HELP_ARTICLES, so a stale path ships a 404 link. The
// help is the one help centre now (liveworkspace/apps/help, liveworkspace/docs/specs/016-help/help-centre.md), whose
// app/ holds every app's articles: a link resolves when its page is on disk AND livedesign's help shows it (an article
// that applies to livedesign, in @livedesign/help-registry's slice, or one of its category landings or fixed pages), since an
// article for other apps only answers livedesign's address with a redirect away. Reading help's app/ here is a
// legitimate cross-app guard: the filesystem is what actually serves the page.
const HELP_APP = fileURLToPath(new URL('../../../../liveworkspace/apps/help/app', import.meta.url));
const SHOWN_ARTICLES = new Set(articles.map((a) => `${a.categorySlug}/${a.slug}`));
const SHOWN_LANDINGS = new Set(['contact', 'features', ...categories.map((c) => c.slug)]);

describe('HELP_ARTICLES deep links resolve to a real help page', () => {
  it("every mapped path is an article (page.mdx) or a landing (page.tsx) that livedesign's help shows", () => {
    const missing = Object.entries(HELP_ARTICLES).filter(([, slug]) => {
      const path = slug.split('#')[0]!.replace(/\/$/, '');
      if (existsSync(`${HELP_APP}/${path}/page.mdx`)) return !SHOWN_ARTICLES.has(path);
      if (existsSync(`${HELP_APP}/${path}/page.tsx`)) return !SHOWN_LANDINGS.has(path);
      return true;
    });
    expect(missing).toEqual([]);
  });
});

describe('every key earns its place', () => {
  // docs/specs/018-help/contextual-help-links.md pairs the two halves: "new placements reuse HelpArticleLink + a
  // HELP_ARTICLES key". A key with no surface is half a placement — it looks
  // like the editor links that article when nothing does, and the existing
  // test above passes happily because the PATH is fine.
  //
  // Six had accumulated. Four (mind maps, lanes, entities, the Behaviour
  // category) never had a placement in docs/specs/018-help/contextual-help-links.md at all. Two more (the Explorer
  // panel, reverting changes) lost theirs when the floating panels' header
  // help icons were deliberately removed, which docs/specs/018-help/contextual-help-links.md records. Every one of
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
    // The editor code every editor shares (@liveworkspace/workbench) can open an article too.
    walk(`${SRC}../../../packages/workbench/src`);
    const haystack = sources.join('\n');
    // Guard against the walk finding nothing, which would pass vacuously.
    expect(sources.length).toBeGreaterThan(200);

    const orphans = Object.keys(HELP_ARTICLES).filter(
      (key) => !new RegExp(`['"]${key}['"]`).test(haystack),
    );
    expect(orphans).toEqual([]);
  });
});

describe('helpArticleHref / helpArticleTelemetryId', () => {
  it('builds an absolute /help path with a trailing slash', () => {
    expect(helpArticleHref('sharing')).toBe('/help/collaboration/sharing/');
  });

  it('returns a slash-free telemetry id', () => {
    expect(helpArticleTelemetryId('shareLinkExpiry')).toBe('share-link-expiry');
    expect(helpArticleTelemetryId('palette')).toBe('palette'); // single-segment value
    for (const key of Object.keys(HELP_ARTICLES) as HelpArticleKey[]) {
      expect(helpArticleTelemetryId(key)).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('gives two different linked pages two different ids', () => {
    // A `UI·Opened` row has to name one page, or two links read as one.
    const idToPath = new Map<string, string>();
    for (const key of Object.keys(HELP_ARTICLES) as HelpArticleKey[]) {
      const id = helpArticleTelemetryId(key);
      const path = HELP_ARTICLES[key];
      expect(idToPath.get(id) ?? path, id).toBe(path);
      idToPath.set(id, path);
    }
  });
});

describe('HELP_LINK_COPY (docs/specs/018-help/contextual-help-links.md)', () => {
  // The hover card on every help link: a "Learn about …" title naming what the
  // reader is looking at, and one line on what the article does for them.
  // The Record type already forces an entry per key; this guards the shape
  // of the copy, so a `?` never says a bare "Learn more" again.
  it('gives every article a "Learn about" title and a one-line description', () => {
    for (const key of Object.keys(HELP_ARTICLES) as (keyof typeof HELP_ARTICLES)[]) {
      const { title, description } = HELP_LINK_COPY[key];
      expect(title, key).toMatch(/^Learn about \S/);
      expect(description, key).toMatch(/^[A-Z].*[.!]$/);
      expect(description, key).not.toContain('\n');
    }
  });
});
