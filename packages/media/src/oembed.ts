// A pasted share link's embed (liveworkspace/docs/specs/006-media/previews.md "Pasting a share link: GET /oembed"), the
// same in every app. Notion (through Iframely), Slack, Medium and Ghost find embeds through oEmbed: the share page's
// head names this endpoint (oembedDiscoveryTag), and each app's router answers `GET /oembed?url=<share link>` with a
// rich iframe of the link's read-only embed. Only a link the card door lets preview unfolds; every other answer is a
// 404, as the share card's is, so the endpoint says nothing the public card door does not.

import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { previewSharePath } from './previews';
import { EMBED_READ_ONLY_PARAM } from './embed-read-only';
import { fetchShareCard, type ShareCardOptions } from './share-card';

/** Where every app's router answers oEmbed. */
export const OEMBED_PATH = '/oembed';
// Every app serves its embed here (APP_ITEMS' `share.embedPath`, `/embed?s=:code`).
const EMBED_PATH = '/embed';

// The Share dialog's iframe size (the Copy iframe snippet), scaled down whole to fit a host's limits.
export const OEMBED_WIDTH = 800;
export const OEMBED_HEIGHT = 500;
// The share card's size (previews.md "GET /api/previews/share/:code/image.png").
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
// A host keeps the unfurl this long at most, so a revoked link's lingers five minutes; no stale window.
export const OEMBED_CACHE_AGE = 300;
const OEMBED_CACHE = `public, max-age=${OEMBED_CACHE_AGE}`;
// The index's own rule for a share code (liveworkspace/apps/index/src/codec.ts isShareCode): anything else is a 404
// without asking the service.
const SHARE_CODE = /^[A-Za-z0-9]{4,64}$/;
// A title is one line, as the share page's is.
const NAME_MAX = 200;
// The longest limit worth reading; a longer one is unreadable and ignored.
const LIMIT_DIGITS = 6;

export type OEmbedConfig = {
  /** The app whose share links this router unfolds: its share page address comes from APP_ITEMS. */
  app: AppName;
  /** The title for an item with a blank name ("Untitled canvas"), as the share page says it. */
  untitled: string;
};

export type OEmbedOptions = ShareCardOptions;

export type OEmbed = {
  isOEmbedPath: (pathname: string) => boolean;
  /** The answer to `GET /oembed?url=…`, for any request whose path isOEmbedPath accepts. */
  oembed: (request: Request, options?: OEmbedOptions) => Promise<Response>;
};

const SHARED_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
};

function refuse(status: number, error: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SHARED_HEADERS,
      ...extra,
    },
  });
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// A host's limit: a positive whole number of pixels, or null for a blank, zero or unreadable one. Digits only, read
// left to right, so no input can make this slow.
export function readLimit(value: string | null): number | null {
  if (value === null || value.length === 0 || value.length > LIMIT_DIGITS) return null;
  let n = 0;
  for (const ch of value) {
    if (ch < '0' || ch > '9') return null;
    n = n * 10 + (ch.charCodeAt(0) - 48);
  }
  return n > 0 ? n : null;
}

/** The embed's size: 800 x 500 scaled down whole to fit both limits, at least 1 x 1. */
export function oembedSize(
  maxWidth: number | null,
  maxHeight: number | null,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxWidth === null ? 1 : maxWidth / OEMBED_WIDTH,
    maxHeight === null ? 1 : maxHeight / OEMBED_HEIGHT,
  );
  return {
    width: Math.max(1, Math.round(OEMBED_WIDTH * scale)),
    height: Math.max(1, Math.round(OEMBED_HEIGHT * scale)),
  };
}

// The same host, or its `www.` twin: the bare domain's pages live on www, so a link copied from either unfolds on both.
function sameSite(a: string, b: string): boolean {
  const bare = (host: string) => (host.startsWith('www.') ? host.slice(4) : host);
  return bare(a) === bare(b);
}

// A share page's address on one of the app's item paths, or the old `/diagram/` one every app still serves.
function sharePagePattern(app: AppName): RegExp {
  const segment = APP_ITEMS[app].itemPath.replace(/\//g, '');
  return new RegExp(`^/(?:${segment}|diagram)/shared/?$`);
}

/** The share page's oEmbed discovery tag, for the share link `code` opens on `origin` at `pathname`. */
export function oembedDiscoveryTag(
  origin: string,
  pathname: string,
  code: string,
  name: string,
): string {
  const shareUrl = `${origin}${pathname}?s=${encodeURIComponent(code)}`;
  const href = `${origin}${OEMBED_PATH}?url=${encodeURIComponent(shareUrl)}&format=json`;
  return `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(href)}" title="${escapeHtml(name)}">`;
}

export function createOEmbed(config: OEmbedConfig): OEmbed {
  const pagePath = sharePagePattern(config.app);

  return {
    isOEmbedPath: (pathname) => pathname === OEMBED_PATH || pathname === `${OEMBED_PATH}/`,
    async oembed(request, options = {}) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return refuse(405, 'method_not_allowed', { Allow: 'GET, HEAD' });
      const asked = new URL(request.url);
      const format = asked.searchParams.get('format');
      if (format !== null && format !== 'json') return refuse(501, 'format_not_supported');
      const raw = asked.searchParams.get('url');
      if (!raw) return refuse(400, 'url_required');
      let link: URL;
      try {
        link = new URL(raw);
      } catch {
        return refuse(400, 'url_invalid');
      }
      const code = link.searchParams.get('s');
      if (
        !sameSite(link.host, asked.host) ||
        !pagePath.test(link.pathname) ||
        !code ||
        !SHARE_CODE.test(code)
      )
        return refuse(404, 'not_found');

      const card = await fetchShareCard(request, code, options, 'oembed');
      if (card === 'denied') return refuse(404, 'not_found');
      if (card === 'unavailable') return refuse(503, 'previews_unavailable');

      const origin = asked.origin;
      const title = card.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || config.untitled;
      const maxWidth = readLimit(asked.searchParams.get('maxwidth'));
      const maxHeight = readLimit(asked.searchParams.get('maxheight'));
      const { width, height } = oembedSize(maxWidth, maxHeight);
      const src = `${origin}${EMBED_PATH}?s=${code}&${EMBED_READ_ONLY_PARAM}=1`;
      const html =
        `<iframe src="${escapeHtml(src)}" width="${width}" height="${height}" ` +
        `title="${escapeHtml(title)}" style="border:0" allowfullscreen></iframe>`;
      const thumbnailFits =
        (maxWidth === null || maxWidth >= CARD_WIDTH) &&
        (maxHeight === null || maxHeight >= CARD_HEIGHT);
      const body = {
        version: '1.0',
        type: 'rich',
        title,
        provider_name: config.app,
        provider_url: origin,
        html,
        width,
        height,
        cache_age: OEMBED_CACHE_AGE,
        ...(thumbnailFits
          ? {
              thumbnail_url: `${origin}${previewSharePath(code, 'image.png')}`,
              thumbnail_width: CARD_WIDTH,
              thumbnail_height: CARD_HEIGHT,
            }
          : {}),
      };
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': OEMBED_CACHE,
          ...SHARED_HEADERS,
        },
      });
    },
  };
}
