import type { Metadata, MetadataRoute } from 'next';
import type { ReactNode } from 'react';
import { articleDates } from './lib/article-dates';
import { featureColour, featureIcon } from './lib/feature-tile';
import {
  buildHelpCards,
  cardRoute,
  helpCardParams,
  routeFromParams,
  type HelpCard,
} from './lib/help-cards';
import { createArticleNeighbours, type ArticleNeighbours } from './lib/neighbours';
import { helpSitemap } from './lib/sitemap';
import { collectionJsonLd, helpName, webSiteJsonLd } from './lib/structured-data';
import type { HelpArt, HelpCatalogue, HelpFacts, HelpSiteConfig } from './types';

export type * from './types';
export type { HelpCard } from './lib/help-cards';

// A product's help centre, bound once (README.md). Each help app calls createHelpSite in its lib/help-site.ts
// with its name, origin, catalogue, art and the few pieces its ui package owns, and hands the result to the
// server components here (`site` prop) and to its route files. Server-side only: the browser half reads
// HelpClientProvider instead (client.tsx).

export interface HelpSite extends ArticleNeighbours {
  facts: HelpFacts;
  catalogue: HelpCatalogue;
  art: HelpArt;
  /** Per-page metadata with a complete Open Graph block, so each page carries its own canonical and OG
   *  title/url rather than inheriting the layout's. `path` is the absolute path including `/help/` and the
   *  trailing slash, matching the page's real route (`/help/<categorySlug>/<slug>/`); a path that disagrees
   *  with the route points the canonical at another page, which nothing at runtime notices
   *  (seo-canonical.test.ts in each app checks every article page). The document <title> still reads
   *  "<Title> | <product>": the root layout's template adds the suffix. */
  helpMetadata: (input: { title: string; description: string; path: `/${string}` }) => Metadata;
  /** The help centre's root metadata: the title template, description, canonical and OG defaults. */
  rootMetadata: (extra?: Metadata) => Metadata;
  /** Every article's and category landing's social card, keyed by route (`canvas/themes`). */
  cards: ReadonlyMap<string, HelpCard>;
  /** The card a page links in its metadata: absolute, since a link preview resolves it from anywhere. */
  cardImage: (path: string) => { url: string; alt: string } | undefined;
  cardParams: () => { card: string[] }[];
  /** The card a request for `/help/og/<route>.png` draws, or undefined. */
  cardFor: (params: string[]) => HelpCard | undefined;
  webSiteJsonLd: () => ReturnType<typeof webSiteJsonLd>;
  collectionJsonLd: (
    input: Parameters<typeof collectionJsonLd>[1],
  ) => ReturnType<typeof collectionJsonLd>;
  featureColour: (slug: string, categorySlug?: string) => string;
  featureIcon: (slug: string, categorySlug?: string) => ReactNode;
  sitemap: () => MetadataRoute.Sitemap;
  robots: () => MetadataRoute.Robots;
}

export function createHelpSite(config: HelpSiteConfig): HelpSite {
  const facts: HelpFacts = {
    siteName: config.siteName,
    siteUrl: config.siteUrl,
    helpUrl: `${config.siteUrl}/help`,
    contactFormUrl: config.contactFormUrl,
  };
  const { catalogue, art } = config;
  const name = helpName(facts);
  const cards = buildHelpCards(catalogue, config.cardSubtitle);

  const cardImage = (path: string) => {
    const route = cardRoute(path);
    const card = cards.get(route);
    if (!card) return undefined;
    return { url: `${facts.helpUrl}/og/${route}.png`, alt: `${card.title}, ${name} Centre` };
  };

  return {
    facts,
    catalogue,
    art,
    ...createArticleNeighbours(catalogue),
    helpMetadata: ({ title, description, path }) =>
      // An article or category landing previews with its own card; any other page with the brand card.
      config.pageMetadata({ title, description, path, siteName: name, image: cardImage(path) }),
    rootMetadata: (extra = {}) => ({
      metadataBase: new URL(facts.siteUrl),
      // Consistent document titles: every page reads "<Page Title> | <product>" (the template reaches every
      // child segment; the root index spells the suffix out itself). Link previews carry the bare title.
      title: { default: `Help | ${facts.siteName}`, template: `%s | ${facts.siteName}` },
      description: `Guides, tutorials, and answers for ${facts.siteName}. Browse feature documentation, getting-started guides, and troubleshooting.`,
      // With the trailing slash every help route has (`trailingSlash: true`, as the sitemap lists the home):
      // `/help` is only the redirect to it.
      alternates: { canonical: '/help/' },
      openGraph: { type: 'website', siteName: name, locale: 'en_GB' },
      twitter: { card: 'summary_large_image' },
      robots: { index: true, follow: true },
      ...extra,
    }),
    cards,
    cardImage,
    cardParams: () => helpCardParams(cards),
    cardFor: (params) => {
      const route = routeFromParams(params);
      return route === null ? undefined : cards.get(route);
    },
    webSiteJsonLd: () => webSiteJsonLd(facts),
    collectionJsonLd: (input) => collectionJsonLd(facts, input),
    featureColour: (slug, categorySlug) => featureColour(art, slug, categorySlug),
    featureIcon: (slug, categorySlug) => featureIcon(art, slug, categorySlug),
    sitemap: () => helpSitemap(facts.helpUrl, catalogue, articleDates()),
    // Fully crawlable, with a pointer to the sitemap.
    robots: () => ({
      rules: { userAgent: '*', allow: '/' },
      sitemap: `${facts.helpUrl}/sitemap.xml`,
      host: facts.siteUrl,
    }),
  };
}
