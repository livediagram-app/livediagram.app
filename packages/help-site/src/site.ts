import {
  articleHref,
  canonicalArticleUrl,
  canonicalScope,
  type HelpScope,
} from '@liveworkspace/help-registry';
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
  /** The one help centre's scope (liveworkspace/docs/specs/017-help/help-centre.md), or undefined for a help
   *  centre of one product alone. */
  scope: HelpScope | undefined;
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
    ...(config.scope && { scope: config.scope }),
    ...(config.guideCounts && { guideCounts: config.guideCounts }),
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

  // The one help centre's canonicals (help-centre.md "Canonical"): an article for one app is canonical on that app's
  // address, one for several on liveworkspace.app, so search engines index one copy. Every other page is canonical
  // where it is shown.
  const scope = config.scope;
  const byPath = new Map(catalogue.articles.map((a) => [`/help${articleHref(a)}`, a]));
  const canonicalOf = (path: string): string | undefined => {
    const article = scope ? byPath.get(path) : undefined;
    return article ? canonicalArticleUrl(article) : undefined;
  };

  const wordedMetadata = <T extends { title: string; description: string; path: `/${string}` }>(
    input: T,
  ): T => {
    const article = scope && scope !== 'all' ? byPath.get(input.path) : undefined;
    const own = article && scope && scope !== 'all' ? article.byApp?.[scope] : undefined;
    if (!article || !own) return input;
    return {
      ...input,
      ...(own.title !== undefined && { title: article.title }),
      ...(own.description !== undefined && { description: article.description }),
    };
  };

  return {
    facts,
    scope,
    catalogue,
    art,
    ...createArticleNeighbours(catalogue),
    helpMetadata: (input) => {
      // An article an app words its own way (help-centre.md "Per-app wording") takes that wording in the app's
      // help, in place of the shared words its MDX passes.
      const { title, description, path } = wordedMetadata(input);
      // An article or category landing previews with its own card; any other page with the brand card.
      const metadata = config.pageMetadata({
        title,
        description,
        path,
        siteName: name,
        image: cardImage(path),
      });
      const canonical = canonicalOf(path);
      if (!canonical) return metadata;
      return {
        ...metadata,
        alternates: { ...metadata.alternates, canonical },
        ...(metadata.openGraph && { openGraph: { ...metadata.openGraph, url: canonical } }),
      };
    },
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
    // A scope lists the articles canonical on its own address, and its own landings.
    sitemap: () =>
      helpSitemap(
        facts.helpUrl,
        scope
          ? {
              ...catalogue,
              articles: catalogue.articles.filter((a) => canonicalScope(a, scope) === scope),
            }
          : catalogue,
        articleDates(),
      ),
    // Fully crawlable, with a pointer to the sitemap.
    robots: () => ({
      rules: { userAgent: '*', allow: '/' },
      sitemap: `${facts.helpUrl}/sitemap.xml`,
      host: facts.siteUrl,
    }),
  };
}
