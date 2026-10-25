// Schema.org JSON-LD builders for the help centre (docs/specs/018-help/help-app.md in each product). Search
// engines read these to render breadcrumb trails, article rich results, and the site name in results. Pure
// functions of the product's facts, returning plain objects; a <JsonLd> renders them into a
// <script type="application/ld+json">. The article shell builds its TechArticle in the browser, so these
// take the serialisable HelpFacts, not the whole site.
//
// The help app is served under /help, so every absolute URL is `${helpUrl}${appPath}`, where appPath is
// the app-relative href the registry produces (articleHref / categoryHref, which omit the basePath).

import type { HelpFacts } from '../types';

/** Absolute help-centre URL from an app-relative href (e.g. "/canvas/themes/"). */
export function helpUrl(facts: HelpFacts, appPath: string): string {
  return `${facts.helpUrl}${appPath}`;
}

/** The help centre's name in results and link previews: `livediagram Help`. */
export const helpName = (facts: HelpFacts) => `${facts.siteName} Help`;

const publisher = (facts: HelpFacts) =>
  ({ '@type': 'Organization', name: facts.siteName, url: facts.siteUrl }) as const;

// BreadcrumbList JSON-LD is emitted by the Breadcrumb component, so it is intentionally not duplicated here.

/** A TechArticle node for a single help guide. */
export function articleJsonLd(
  facts: HelpFacts,
  input: { title: string; description: string; appPath: string },
) {
  const url = helpUrl(facts, input.appPath);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'en-GB',
    author: publisher(facts),
    publisher: publisher(facts),
  };
}

/** The site-wide WebSite node (help home), naming the help centre in results. */
export function webSiteJsonLd(facts: HelpFacts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: helpName(facts),
    url: `${facts.helpUrl}/`,
    publisher: publisher(facts),
    inLanguage: 'en-GB',
  };
}

/** A category landing (docs/specs/018-help/help-app.md "SEO"): a CollectionPage whose ItemList names every
 *  article the page lists, in the order shown, so a search engine reads the landing as an index of guides. */
export function collectionJsonLd(
  facts: HelpFacts,
  input: {
    title: string;
    description: string;
    appPath: string;
    items: { name: string; appPath: string }[];
  },
) {
  const url = helpUrl(facts, input.appPath);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.title,
    description: input.description,
    url,
    inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: helpName(facts), url: `${facts.helpUrl}/` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: input.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: helpUrl(facts, item.appPath),
      })),
    },
  };
}
