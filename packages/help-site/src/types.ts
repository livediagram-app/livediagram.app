import type { Article, Category } from '@liveworkspace/help-registry';
import type { Metadata } from 'next';
import type { ComponentType, ReactNode } from 'react';

// What a product hands its help centre (README.md). Everything here is the product's own: its name and
// origin, its catalogue, its card art, and the few site pieces its ui package owns. The help centre's pages,
// components and helpers are this package's, the same for every product.

/** A link a page shows: a title and where it goes. */
export interface ArticleLink {
  title: string;
  href: string;
}

/** A category's landing cards, in its groups (the registry's getCategoryGroups). */
export type CategoryGroups = { group: string; articles: Article[] }[];

/** The product's help catalogue, as its @<product>/help-registry exports it. */
export interface HelpCatalogue {
  articles: readonly Article[];
  categories: readonly Category[];
  getCategoryGroups: (categorySlug: string) => CategoryGroups;
}

/** The plain facts about the product a help page prints: serialisable, so a client component can take them. */
export interface HelpFacts {
  /** The product's name as it is written, its SITE_NAME: `livediagram`. */
  siteName: string;
  /** The product's origin, its SITE_URL: `https://livediagram.app`. */
  siteUrl: string;
  /** `${siteUrl}/help`, the prefix every absolute help URL builds on. */
  helpUrl: string;
  /** The product's public contact form, the way on from an article that did not help. */
  contactFormUrl: string;
}

/** The product's card art: what each feature, support article and category is drawn with. */
export interface HelpArt {
  /** Feature slug → accent hue (hex), and top-level category → hue for a feature without its own. */
  featureHex: Readonly<Record<string, string>>;
  categoryHex: Readonly<Record<string, string>>;
  /** Feature slug → glyph, top-level category → glyph for a feature without its own, and the glyph for a
   *  feature with neither (the product's canvas glyph). */
  featureIcons: Readonly<Record<string, ReactNode>>;
  categoryIcons: Readonly<Record<string, ReactNode>>;
  featureFallback: ReactNode;
  /** Support-article slug → glyph, and the generic glyph a support card with none falls back to. */
  supportIcons: Readonly<Record<string, ReactNode>>;
  supportFallback: ReactNode;
  /** Top-level category → its scene, for the category cards and landings. */
  categoryArt: Readonly<Record<string, ComponentType>>;
}

/** The product's page-metadata rule (pageMetadata in its ui package), in the shape the help centre calls it. */
export type PageMetadata = (input: {
  title: string;
  description: string;
  path: `/${string}`;
  siteName?: string;
  image?: { url: string; alt: string };
}) => Metadata;

export interface HelpSiteConfig {
  siteName: string;
  siteUrl: string;
  contactFormUrl: string;
  catalogue: HelpCatalogue;
  art: HelpArt;
  pageMetadata: PageMetadata;
  /** The product's social-card subtitle rule (cardSubtitle in its ui package). */
  cardSubtitle: (text: string) => string;
}
