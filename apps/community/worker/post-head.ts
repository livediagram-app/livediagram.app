// What a Community post's page says about itself before any script runs (docs/specs/025-community/community.md
// "Search engines"). The post page is one static shell for every post, so its <head> names no post; the worker
// (./index.ts) fills these in from the api, so a crawler or a link preview that never runs the page's script still
// sees the post's own title, description, address and structured data. Pure, so it is tested without a runtime.

import {
  communityCategoryLabel,
  communityPostPath,
  type CommunityPost,
  type CommunitySitemapEntry,
} from '@livediagram/api-schema';
import { breadcrumbJsonLd } from '@livediagram/ui/seo';
import { SITE_URL } from '@livediagram/ui/site';

// The same title suffix the page sets for itself once the post loads (components/post/PostView.tsx).
const POST_TITLE_SUFFIX = ' | livediagram Community';
// A search result shows about 160 characters; the marketing site and the help centre hold theirs to it.
export const META_DESCRIPTION_MAX = 160;

// How long a page waits on the api before giving up and serving the plain shell. The post read is one indexed D1
// lookup (tens of milliseconds), so this only bites when the api is in trouble.
export const API_TIMEOUT_MS = 1500;

export type PostHead = {
  title: string;
  description: string;
  canonical: string;
  jsonLd: unknown;
};

// The post's description cut at a whole word to fit a search result, or a plain fallback when it has none.
export function metaDescription(post: Pick<CommunityPost, 'description' | 'title'>): string {
  const text = post.description.replace(/\s+/g, ' ').trim();
  if (text === '')
    return `${post.title}, shared to the livediagram Community. Open it, explore it, and make your own copy.`.slice(
      0,
      META_DESCRIPTION_MAX,
    );
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

export function postHead(post: CommunityPost): PostHead {
  const canonical = `${SITE_URL}${communityPostPath(post.id)}`;
  const description = metaDescription(post);
  const community = `${SITE_URL}/community/`;
  return {
    title: `${post.title}${POST_TITLE_SUFFIX}`,
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
          isPartOf: { '@type': 'CollectionPage', name: 'livediagram Community', url: community },
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
// shared JsonLd component in @livediagram/ui).
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// The Community sitemap: one <url> per public post, at its canonical address, with when it last changed.
export function sitemapXml(posts: CommunitySitemapEntry[]): string {
  const urls = posts
    .map(
      (p) =>
        `<url><loc>${escapeHtml(`${SITE_URL}${communityPostPath(p.id)}`)}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod></url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
