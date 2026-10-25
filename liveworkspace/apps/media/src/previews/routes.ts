// /api/previews (liveworkspace/docs/previews.md "The addresses"): every app's item pictures, for browsers, on
// liveworkspace.app and (forwarded by each app's router) on every app's own origin.
//
//   GET /api/previews/items/:id?v=              the Explorer's preview, for whoever the index lets read the item
//   GET /api/previews/share/:code/image.svg     the live image, the code its only credential
//   GET /api/previews/share/:code/image.png     the share card
//   GET /api/previews/share/:code/card          { name }, for the app's share page head

import {
  BRAND_CARD_PATH,
  BRAND_CARD_REDIRECT_CACHE,
  isSharePreviewDoor,
  PREVIEW_DENIED_CACHE,
  PREVIEW_ITEM_CACHE,
  PREVIEW_PUBLIC_ITEM_CACHE,
  PUBLIC_LINK_CACHE,
  SHARE_CARD_CACHE,
  SHARE_IMAGE_CACHE,
  type SharePreviewCard,
  type SharePreviewDoor,
} from '@liveworkspace/media';
import type { Env } from '../env';
import { reachItem, reachLink, type PreviewItem } from './access';
import { shareCardPng } from './share-card-png';
import { cardKey, drawing, svgText, type Defer, type Drawing, type Subject } from './store';

// Served on liveworkspace's and every app's origin, so an SVG opened on its own is a document that could run script.
// The renderers escape everything they write; this keeps a slip there from becoming stored XSS. Fonts and inline
// data images (what a drawing uses) still load.
const SVG_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
  'font-src https://fonts.gstatic.com; img-src data:; sandbox';

// A public door answers any page that embeds it; an item's preview is same-origin only (it carries a token).
const PUBLIC_HEADERS = { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };

function answer(status: number, cache: string, headers: Record<string, string> = {}): Response {
  return new Response(status === 404 ? JSON.stringify({ error: 'not_found' }) : null, {
    status,
    headers: {
      'Cache-Control': cache,
      ...(status === 404 ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  });
}

const denied = (headers: Record<string, string> = {}) => answer(404, PREVIEW_DENIED_CACHE, headers);
const unavailable = () =>
  new Response(JSON.stringify({ error: 'previews_unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function svgResponse(
  d: Extract<Drawing, { kind: 'svg' }>,
  cache: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(d.object ? d.object.body : (d.svg ?? ''), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cache,
      'Content-Security-Policy': SVG_CSP,
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

const subjectOf = (item: PreviewItem, tabId: string | null): Subject => ({
  app: item.app,
  itemId: item.id,
  version: item.updatedAt,
  tabId,
  code: item.publicCode,
});

// ---------- The Explorer's preview -------------------------------------------------------------------------------

async function itemPreview(request: Request, env: Env, id: string, defer: Defer) {
  const item = await reachItem(env, request, id);
  if (item === 'unavailable') return unavailable();
  if (item === 'denied') return denied();
  // A public link's picture must not outlive its post in a browser: no day-long cache for it.
  const cache = item.publicCode ? PREVIEW_PUBLIC_ITEM_CACHE : PREVIEW_ITEM_CACHE;
  // The summary already says the first tab has nothing to draw: no call at all.
  if (item.empty && item.tabId === null) return answer(404, cache);
  const d = await drawing(env, subjectOf(item, item.tabId), defer);
  if (d.kind === 'svg') return svgResponse(d, cache);
  if (d.kind === 'empty') return answer(404, cache);
  if (d.kind === 'missing') return denied();
  return unavailable();
}

// ---------- A share link's doors -----------------------------------------------------------------------------------

async function shareDoor(
  url: URL,
  env: Env,
  code: string,
  door: SharePreviewDoor,
  defer: Defer,
): Promise<Response> {
  const item = await reachLink(env, code);
  if (item === 'unavailable') return unavailable();
  if (item === 'denied') return denied(PUBLIC_HEADERS);
  const isPublic = item.publicCode !== null;

  if (door === 'card') {
    // A public link's name shows only while its app still shows the link anything.
    if (isPublic) {
      const d = await drawing(env, subjectOf(item, item.tabId), defer);
      if (d.kind === 'svg') await d.object?.body.cancel();
      if (d.kind === 'missing') return denied(PUBLIC_HEADERS);
      if (d.kind === 'unavailable') return unavailable();
    }
    const body: SharePreviewCard = { name: item.title };
    return new Response(JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...PUBLIC_HEADERS,
      },
    });
  }

  if (door === 'image.svg') {
    // `?tab=` picks a tab; a link confined to one always draws its own, and another is a 404 before drawing.
    const asked = url.searchParams.get('tab');
    if (item.tabId !== null && asked !== null && asked !== item.tabId)
      return denied(PUBLIC_HEADERS);
    const tabId = item.tabId ?? (asked || null);
    if (item.empty && tabId === null) return denied(PUBLIC_HEADERS);
    const d = await drawing(env, subjectOf(item, tabId), defer);
    if (d.kind === 'svg') {
      return svgResponse(d, isPublic ? PUBLIC_LINK_CACHE : SHARE_IMAGE_CACHE, PUBLIC_HEADERS);
    }
    if (d.kind === 'unavailable') return unavailable();
    return denied(PUBLIC_HEADERS);
  }

  return shareCard(env, item, defer);
}

// The brand card, on the origin the crawler asked (a relative Location).
const brandCard = () =>
  new Response(null, {
    status: 302,
    headers: { Location: BRAND_CARD_PATH, 'Cache-Control': BRAND_CARD_REDIRECT_CACHE },
  });

async function shareCard(env: Env, item: PreviewItem, defer: Defer): Promise<Response> {
  const bucket = env.MEDIA;
  if (!bucket) return unavailable();
  const cache = item.publicCode !== null ? PUBLIC_LINK_CACHE : SHARE_CARD_CACHE;
  const png = (body: ReadableStream | Uint8Array) =>
    new Response(body, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': cache, ...PUBLIC_HEADERS },
    });
  if (item.empty && item.tabId === null) return brandCard();
  const subject = subjectOf(item, item.tabId);
  const d = await drawing(env, subject, defer);
  if (d.kind === 'missing') return denied(PUBLIC_HEADERS);
  if (d.kind === 'unavailable') return unavailable();
  if (d.kind === 'empty') return brandCard();
  // The card is drawn from the drawing beside it: fresh while it names that drawing's version.
  const key = cardKey(subject);
  const stored = await bucket.get(key);
  if (stored && stored.customMetadata?.av === d.av) {
    await d.object?.body.cancel();
    return png(stored.body);
  }
  await stored?.body.cancel();
  let card: Uint8Array | null;
  try {
    card = await shareCardPng(await svgText(d));
  } catch (err) {
    console.warn('[previews] share card failed', { itemId: item.id, error: String(err) });
    return brandCard();
  }
  if (card === null) return brandCard();
  defer(
    bucket
      .put(key, card, {
        httpMetadata: { contentType: 'image/png' },
        customMetadata: { av: d.av },
      })
      .catch((err: unknown) => {
        console.warn('[previews] card write failed', { key, error: String(err) });
      }),
  );
  return png(card);
}

// ---------- Routing ------------------------------------------------------------------------------------------------

/** Everything under /api/previews. `path` is what follows it. */
export async function handlePreviews(
  request: Request,
  env: Env,
  url: URL,
  path: string,
  defer: Defer,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let segments: string[];
  try {
    segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return denied();
  }
  const [head, key, door] = segments;
  if (head === 'items' && key && segments.length === 2)
    return itemPreview(request, env, key, defer);
  if (head === 'share' && key && segments.length === 3 && isSharePreviewDoor(door)) {
    return shareDoor(url, env, key, door, defer);
  }
  return denied();
}
