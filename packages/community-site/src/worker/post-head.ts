// What a Community post's page says about itself before any script runs (liveworkspace/docs/specs/007-community/
// community.md "Shared pieces"; each product's 025-community "Search engines"). The post page is one static shell for
// every post, so its <head> names no post; the Worker (./index.ts) fills these in from the service, so a crawler or a
// link preview that never runs the page's script still sees the post's own title, description, address and
// structured data. Pure, so it is tested without a runtime.

import {
  communityCategoryLabel,
  type CommunityApp,
  type CommunityPost,
  type CommunitySitemapEntry,
} from '@liveworkspace/community';
import { breadcrumbJsonLd } from '@liveworkspace/ui/breadcrumb-json-ld';
import { communityPostPath } from '../lib/links';

/** The app a Community Worker answers for. */
export type CommunityWorkerSite = {
  /** Whose posts it names. */
  app: CommunityApp;
  /** The app's canonical origin, no trailing slash (`https://www.livediagram.app`). */
  siteUrl: string;
  /** The product's name, as its pages say it ("livediagram"). */
  product: string;
};

// A search result shows about 160 characters; the marketing sites and the help centres hold theirs to it.
export const META_DESCRIPTION_MAX = 160;

// How long a page waits on the service before giving up and serving the plain shell. The post read is one indexed D1
// lookup (tens of milliseconds), so this only bites when the service is in trouble.
export const API_TIMEOUT_MS = 1500;

export type PostHead = {
  title: string;
  description: string;
  canonical: string;
  jsonLd: unknown;
};

// The Community's name in a title, the same suffix the page sets for itself once the post loads
// (components/post/PostView.tsx).
const communityName = (site: CommunityWorkerSite) => `${site.product} Community`;

// The post's description cut at a whole word to fit a search result, or a plain fallback when it has none.
export function metaDescription(
  site: CommunityWorkerSite,
  post: Pick<CommunityPost, 'description' | 'title'>,
): string {
  const text = post.description.replace(/\s+/g, ' ').trim();
  if (text === '')
    return `${post.title}, shared to the ${communityName(site)}. Open it, explore it, and make your own copy.`.slice(
      0,
      META_DESCRIPTION_MAX,
    );
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

export function postHead(site: CommunityWorkerSite, post: CommunityPost): PostHead {
  const canonical = `${site.siteUrl}${communityPostPath(post.id)}`;
  const description = metaDescription(site, post);
  const community = `${site.siteUrl}/community/`;
  return {
    title: `${post.title} | ${communityName(site)}`,
    description,
    canonical,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CreativeWork',
          '@id': canonical,
          url: canonical,
          name: post.title,
          description,
          genre: communityCategoryLabel(post.category),
          ...(post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
          datePublished: new Date(post.publishedAt).toISOString(),
          dateModified: new Date(post.updatedAt).toISOString(),
          // An anonymous post names nobody, in the markup as on the page.
          ...(post.anonymous ? {} : { author: { '@type': 'Person', name: post.author.name } }),
          isPartOf: { '@type': 'CollectionPage', name: communityName(site), url: community },
        },
        breadcrumbJsonLd([
          { name: 'Community', url: community },
          { name: post.title, url: canonical },
        ]),
      ],
    },
  };
}

// Escapes a value for an HTML attribute or text appended as raw markup.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// JSON-LD inlined in a <script>: every `<` escaped so no string inside can close the tag (the same rule as the
// shared JsonLd component).
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// The Community sitemap: one <url> per public post, at its canonical address, with when it last changed.
export function sitemapXml(site: CommunityWorkerSite, posts: CommunitySitemapEntry[]): string {
  const urls = posts
    .map(
      (p) =>
        `<url><loc>${escapeHtml(`${site.siteUrl}${communityPostPath(p.id)}`)}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod></url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
