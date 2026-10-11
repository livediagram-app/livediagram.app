import type { MetadataRoute } from 'next';
import { articleHref, articles, categories, categoryHref } from '@/lib/articles';
import { articleDates } from '@/lib/article-dates';
import { HELP_URL } from '@/lib/site';

const BASE = HELP_URL;

// Static sitemap for the help centre. Mirrors the article index in
// lib/articles.ts so new content is picked up automatically.
export const dynamic = 'force-static';

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

// `/canvas/themes/` → `canvas/themes`, the key lib/article-dates.ts uses.
const routeOf = (href: string) => href.replace(/^\/|\/$/g, '');

// `lastModified` is each page's last commit (lib/article-dates.ts), and left out when that is unknown
// (docs/specs/018-help/help-app.md "SEO").
const lastModified = (date: Date | undefined) => (date ? { lastModified: date } : {});

export default function sitemap(): MetadataRoute.Sitemap {
  const dates = articleDates();
  const newest = newestUnder(dates, '');
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, ...lastModified(newest), changeFrequency: 'weekly', priority: 1 },
    {
      url: `${BASE}/features/`,
      ...lastModified(newest),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  for (const cat of categories) {
    entries.push({
      url: `${BASE}${categoryHref(cat.slug)}`,
      ...lastModified(newestUnder(dates, cat.slug)),
      changeFrequency: cat.slug === 'contact' ? 'monthly' : 'weekly',
      priority: cat.slug === 'contact' ? 0.5 : 0.8,
    });
  }

  for (const article of articles) {
    const href = articleHref(article);
    entries.push({
      url: `${BASE}${href}`,
      ...lastModified(dates.get(routeOf(href))),
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
