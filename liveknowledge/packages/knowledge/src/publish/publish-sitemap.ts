// A public site's sitemap (docs/specs/030-knowledgebase/publishing.md "The public site", "SEO"): every published page
// with its last save, or none while Hide From Search Engines is on.
import { escapeHtml } from './publish-writing';
import { pagePath, type SiteView } from './publish-site';

/** The sitemap's XML for a site and the save time of each of its pages, by address. */
export function renderSitemap(view: SiteView, savedAt: ReadonlyMap<string, number>): string {
  const urls = view.noindex
    ? ''
    : view.tree
        .map((entry) => {
          const at = savedAt.get(entry.address);
          const lastmod = at ? `<lastmod>${new Date(at).toISOString().slice(0, 10)}</lastmod>` : '';
          return `<url><loc>${escapeHtml(`${view.origin}${pagePath(view, entry.address)}`)}</loc>${lastmod}</url>`;
        })
        .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
