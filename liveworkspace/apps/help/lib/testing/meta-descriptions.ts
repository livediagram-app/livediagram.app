import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';
import { contactMetadata } from '@liveworkspace/help-site/components/ContactPage';
import { featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { helpHomeMetadata } from '@liveworkspace/help-site/components/HelpHome';
import { site } from '@/lib/help-site';
import { SCOPE } from '@/lib/scope.generated';
import { supportCopy, SUPPORT_SLUGS } from '@/lib/support-copy';
import { readScoped, scopedArticleSources, scopedLandingFiles } from './scoped-articles';

// The metadata checks every edition runs over the pages its scope shows. A search result shows about 160 characters
// of a meta description and cuts the rest mid-sentence; under about 50 it is too thin to earn the click
// (liveworkspace/docs/specs/017-help/help-centre.md, each product's marketing site holds its pages to the same range).
// Titles are held unique too: two pages titled alike compete for one query and read as duplicates to a search engine.
// Each page is read in the scope's wording: an article the app words its own way (Article.byApp) shows that title and
// description there, as lib/help-site's helpMetadata does.
const MIN = 50;
const MAX = 160;

type Meta = { page: string; title: string | null; description: string | null };

const literal = (block: string | undefined, key: string) =>
  block?.match(new RegExp(`${key}:\\s*(['"])((?:(?!\\1).)*)\\1`))?.[2] ?? null;

function articleMeta(file: string, source: string): Meta {
  const block = source.match(/helpMetadata\(\{[\s\S]*?\}/)?.[0];
  const path = file.slice(0, -'/page.mdx'.length);
  const entry = site.catalogue.articles.find((a) => `${a.categorySlug}/${a.slug}` === path);
  const own = SCOPE === 'all' ? undefined : entry?.byApp?.[SCOPE];
  return {
    page: file,
    title: own?.title ?? literal(block, 'title'),
    description: own?.description ?? literal(block, 'description'),
  };
}

const titleOf = (title: Metadata['title']): string | null => {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object')
    return 'absolute' in title ? title.absolute : 'default' in title ? title.default : null;
  return null;
};
const fromMetadata = (page: string, m: Metadata): Meta => ({
  page,
  title: titleOf(m.title),
  description: m.description ?? null,
});

export function describeMetaDescriptions({
  articleFloor,
  featureLandingFloor = 5,
}: {
  articleFloor: number;
  /** The fewest feature-category landings the scope shows (liveknowledge has five). */
  featureLandingFloor?: number;
}) {
  const articles = scopedArticleSources().map(({ file, source }) => articleMeta(file, source));
  const shown = new Set(site.catalogue.categories.map((c) => c.slug));
  // The support landings' copy (lib/support-copy.ts), the home, contact and the features index.
  const staticPages: Meta[] = [
    ...SUPPORT_SLUGS.filter((slug) => shown.has(slug)).flatMap((slug) => {
      const copy = supportCopy(SCOPE, slug);
      return copy ? [{ page: slug, title: copy.title, description: copy.description }] : [];
    }),
    fromMetadata('home', helpHomeMetadata(site)),
    fromMetadata('contact', contactMetadata(site)),
    fromMetadata('features', featuresMetadata(site)),
  ];
  // A feature landing takes its category's title and description from the catalogue (lib/landings.tsx).
  const featureLandings = scopedLandingFiles()
    .filter((f) => readScoped(f).includes('featureLanding('))
    .map((f) => f.slice(0, -'/page.tsx'.length))
    .flatMap((slug) => site.catalogue.categories.filter((c) => c.slug === slug))
    .map((c) => ({ page: c.slug, title: c.title, description: c.description }));

  const pages = [...articles, ...staticPages, ...featureLandings];

  describe('help page metadata', () => {
    it('reads every page (guard against this test going blind)', () => {
      expect(articles.length).toBeGreaterThan(articleFloor);
      expect(articles.filter((a) => a.title === null || a.description === null)).toEqual([]);
      expect(staticPages.filter((p) => p.description !== null).length).toBeGreaterThan(3);
      expect(featureLandings.length).toBeGreaterThan(featureLandingFloor);
    });

    it('every meta description fits a search result', () => {
      const misfits = pages
        .filter((p) => p.description !== null)
        .filter((p) => p.description!.length < MIN || p.description!.length > MAX)
        .map((p) => `${p.page} (${p.description!.length} chars)`);
      expect(misfits).toEqual([]);
    });

    it('no two pages share a title', () => {
      const titles = pages.map((p) => p.title);
      expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
    });
  });
}
