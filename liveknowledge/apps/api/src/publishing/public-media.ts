// A published page's pictures, at /kb/<site>/media/<picture> (docs/specs/030-knowledgebase/publishing.md "Pictures
// on the public site"; blueprint publishing.md P35, P36). Answered with no identity: the request carries nothing to
// trust, so the site's knowledgebase decides from its published snapshot alone whether a page it publishes places
// the picture (published-media.ts), and only then are the bytes read from the media service. Kept by the edge as a
// page is, so Unpublish takes a picture down within the same minute as its page.
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { isGalleryImageId } from '@liveworkspace/media';
import { documentRoom } from '../document-client';
import { mediaClient } from '../media';
import type { Env } from '../types';
import { publishedMediaPath } from './published-media';
import { siteAddress } from './site-addresses';

/** How long the edge and a browser keep a picture: its page's own lifetime (public-site.ts). */
export const PUBLISHED_MEDIA_SECONDS = 60;

/** A picture answered on its own runs nothing and is not another site's to embed (P35). */
export const PUBLIC_MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const LIFETIME = `public, max-age=${PUBLISHED_MEDIA_SECONDS}`;

/** The picture's id from its path segment, or null for one no gallery holds (checked before any lookup). */
export function pictureIdOf(segment: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return isGalleryImageId(id) ? id : null;
}

// The picture's validator: its id never changes its bytes, so the id is the version.
const etagOf = (imageId: string) => `"${encodeURIComponent(imageId)}"`;

const nothing = (cacheControl = LIFETIME) =>
  new Response(null, {
    status: 404,
    headers: { 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' },
  });

// A browser that holds this picture already is told so, without its bytes.
function notChanged(request: Request, etag: string): Response | null {
  const asked = request.headers.get('If-None-Match');
  if (asked === null || !asked.split(',').some((tag) => tag.trim() === etag)) return null;
  return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': LIFETIME } });
}

// The answer for a picture the snapshot says may be served, read now.
async function picture(env: Env, imageId: string): Promise<Response> {
  const media = mediaClient(env);
  if (!media) return nothing('no-store');
  let object: Awaited<ReturnType<typeof media.bytes>>;
  try {
    object = await media.bytes(imageId);
  } catch (error) {
    // Not kept by the edge: the next fetch tries again.
    console.warn('[publishing] media_unreadable', { error: String(error) });
    return nothing('no-store');
  }
  if (!object?.body) return nothing();
  return new Response(object.body, {
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': LIFETIME,
      ETag: etagOf(imageId),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': PUBLIC_MEDIA_CSP,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

type Waiter = (promise: Promise<unknown>) => void;

/** One fetch of a published picture. `cache` is the edge's, where the runtime has one. */
export async function handlePublicMedia(
  request: Request,
  env: Env,
  site: string,
  imageId: string,
  cache: Cache | null,
  waitUntil: Waiter,
): Promise<Response> {
  const url = new URL(request.url);
  const etag = etagOf(imageId);
  const key = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (hit.ok && notChanged(request, etag)) || hit;
  // An answer worth keeping is kept by the edge for its lifetime; a failure to read the picture is not.
  const keep = (response: Response): Response => {
    if (cache && response.headers.get('Cache-Control') !== 'no-store')
      waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return response;
  };

  // Only what the edge has not kept reaches the knowledgebase and the media service, so only that is limited (P36),
  // under its own key: a page full of pictures never spends a reader's searches.
  if (env.SEARCH_RATE_LIMITER) {
    const ok = await env.SEARCH_RATE_LIMITER.limit({ key: `kb-media:${clientRateKey(request)}` });
    if (!ok.success)
      return new Response(null, {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
      });
  }

  const holder = await siteAddress(env, site, { kind: 'read' });
  if (!holder || typeof holder === 'string') return keep(nothing());
  if (holder.movedTo)
    return keep(
      new Response(null, {
        status: 301,
        headers: {
          Location: publishedMediaPath(holder.movedTo, imageId),
          'Cache-Control': LIFETIME,
        },
      }),
    );
  const placed = await documentRoom(env, holder.documentId).publishedRead({
    kind: 'media',
    imageId,
  });
  if (placed.status !== 'media') return keep(nothing());
  const unchanged = notChanged(request, etag);
  if (unchanged) return unchanged;
  return keep(await picture(env, imageId));
}
