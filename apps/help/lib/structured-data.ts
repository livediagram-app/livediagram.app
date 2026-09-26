// Schema.org JSON-LD builders for the help centre (docs/specs/018-help/help-app.md). Search engines
// read these to render breadcrumb trails, article rich results, and the site
// name in results. Pure functions returning plain objects; a <JsonLd> renders
// them into a <script type="application/ld+json">.
//
// The help app is served under /help, so every absolute URL is
// `${SITE}/help${appPath}` where appPath is the app-relative href the article
// registry produces (articleHref / categoryHref, which omit the basePath).

import { SITE_NAME, SITE_URL as SITE } from '@livediagram/ui';
import { HELP_URL as HELP } from './site';

/** Absolute help-centre URL from an app-relative href (e.g. "/canvas/themes/"). */
export function helpUrl(appPath: string): string {
  return `${HELP}${appPath}`;
}

const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE,
} as const;

// BreadcrumbList JSON-LD is emitted by the shared Breadcrumb component, so it
// is intentionally not duplicated here.

/** A TechArticle node for a single help guide. */
export function articleJsonLd(input: { title: string; description: string; appPath: string }) {
  const url = helpUrl(input.appPath);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'en-GB',
    author: PUBLISHER,
    publisher: PUBLISHER,
  };
}

/** The site-wide WebSite node (help home), naming the help centre in results. */
export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'livediagram Help',
    url: `${HELP}/`,
    publisher: PUBLISHER,
    inLanguage: 'en-GB',
  };
}
