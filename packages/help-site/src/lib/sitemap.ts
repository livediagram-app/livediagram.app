import { articleHref, categoryHref } from '@liveworkspace/help-registry';
import type { MetadataRoute } from 'next';
import type { HelpCatalogue } from '../types';

// The help centre's static sitemap (docs/specs/018-help/help-app.md "SEO"): the home, the features index, every
// category landing and every article, from the registry, so new content is picked up automatically.
// `lastModified` is each page's last commit (article-dates.ts), and left out when that is unknown.

// The newest of the dates for routes at or under `prefix` ('' for everything): a landing page lists its
// articles, so it changes when any of them does.
function newestUnder(dates: Map<string, Date>, prefix: string): Date | undefined {
  let newest: Date | undefined;
  for (const [route, date] of dates) {
    const under = prefix === '' || route === prefix || route.startsWith(`${prefix}/`);
    if (under && (!newest || date > newest)) newest = date;
  }
  return newest;
}

// `/canvas/themes/` → `canvas/themes`, the key article-dates.ts uses.
const routeOf = (href: string) => href.replace(/^\/|\/$/g, '');

const lastModified = (date: Date | undefined) => (date ? { lastModified: date } : {});

export function helpSitemap(
  helpUrl: string,
  { articles, categories }: HelpCatalogue,
  dates: Map<string, Date>,
): MetadataRoute.Sitemap {
  const newest = newestUnder(dates, '');
  const entries: MetadataRoute.Sitemap = [
    { url: `${helpUrl}/`, ...lastModified(newest), changeFrequency: 'weekly', priority: 1 },
    {
      url: `${helpUrl}/features/`,
      ...lastModified(newest),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  for (const cat of categories) {
    entries.push({
      url: `${helpUrl}${categoryHref(cat.slug)}`,
      ...lastModified(newestUnder(dates, cat.slug)),
      changeFrequency: cat.slug === 'contact' ? 'monthly' : 'weekly',
      priority: cat.slug === 'contact' ? 0.5 : 0.8,
    });
  }

  for (const article of articles) {
    const href = articleHref(article);
    entries.push({
      url: `${helpUrl}${href}`,
      ...lastModified(dates.get(routeOf(href))),
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
