// What a share link shows without opening the document (docs/specs/013-workspace/live-image-share.md,
// docs/specs/013-workspace/share-link-previews.md): three public doors, the code in the URL the only credential.
//
//   GET /api/share/<code>/image.svg  the live image: the link's drawing, for a bare <img> in a README or wiki;
//   GET /api/share/<code>/card       { name } for the editor app's worker, which writes it into the share page's head;
//   GET /api/share/<code>/image.png  the share card, a 1200 x 630 PNG of the same drawing.
//
// The link is the index's (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"): each door resolves the code
// there as an anonymous visitor would, so all three answer exactly where the link opens: an unknown, revoked or
// expired code, a trashed document, and a link with a password (an <img> cannot send one) are all 404.

import { BRAND_CARD_PATH, type SharePreviewResponse } from '@livedocuments/api-schema';
import { IndexError } from '@liveworkspace/index-client';
import { getDocumentThumbMeta, shareCardKey, type DocumentThumbMeta } from '../db/documents';
import { indexFor } from '../index-service';
import { documentImageSvg } from '../document-image';
import { json, notFound, pngImage, svgImage } from '../responses';
import { shareCardPng } from '../share-card-png';
import type { RouteContext } from './context';

// A link's card changes only when its document is saved, and a chat app keeps its own copy for far longer, so a
// few minutes fresh and an hour stale costs nothing in accuracy.
export const SHARE_CARD_CACHE = 'public, max-age=300, stale-while-revalidate=3600';
// The brand card stands in for a document with nothing to draw yet; short, so its first drawing shows soon after.
export const BRAND_CARD_REDIRECT_CACHE = 'public, max-age=300';
// The live image stays close to live without the origin drawing on every view (the bytes come from R2; the document
// draws again only when it was saved since).
export const SHARE_IMAGE_CACHE = 'public, max-age=30, stale-while-revalidate=300';

const PREVIEW_DOORS = new Set(['image.svg', 'card', 'image.png']);

// `api/share/<code>/<door>`, as the worker splits them. The share rate limiter keys these apart from the share
// resolve, so a room of people opening one link never spends the editor's budget on previews.
export function isSharePreviewPath(segments: readonly string[]): boolean {
  return segments.length === 4 && segments[1] === 'share' && PREVIEW_DOORS.has(segments[3]!);
}

type PreviewSubject = { doc: DocumentThumbMeta; tabId: string | null };

// The one gate every door shares: the link as an anonymous visitor opens it, and the document it opens.
async function previewSubject(ctx: RouteContext, code: string): Promise<PreviewSubject | null> {
  const index = indexFor(ctx.env, { kind: 'bearer', token: null });
  if (!index) return null;
  let tabId: string | null;
  let documentId: string;
  try {
    const resolved = await index.resolveShare(code, null);
    documentId = resolved.item.id;
    tabId = resolved.tabId;
  } catch (err) {
    // A refusal (unknown code, a password, a trashed document) is a 404 like any other miss.
    if (!(err instanceof IndexError))
      console.warn('[share-preview] index unreachable', String(err));
    return null;
  }
  const doc = await getDocumentThumbMeta(ctx.env, documentId);
  return doc ? { doc, tabId } : null;
}

// Null for every path this module does not own, so the share router falls through to its own answers.
export async function handleSharePreview(ctx: RouteContext): Promise<Response | null> {
  const { request, segments } = ctx;
  if (!isSharePreviewPath(segments) || request.method !== 'GET') return null;
  const code = segments[2]!;
  if (segments[3] === 'image.svg') return liveImage(ctx, code);
  return segments[3] === 'card' ? shareCard(ctx, code) : shareCardImage(ctx, code);
}

async function liveImage(ctx: RouteContext, code: string): Promise<Response> {
  const subject = await previewSubject(ctx, code);
  if (!subject) return notFound();
  // A tab-scoped link draws its tab; `?tab=` may pick another tab only on a whole-document link.
  const asked = ctx.url.searchParams.get('tab');
  const tabId = subject.tabId ?? (asked || null);
  const svg = await documentImageSvg(ctx.env, subject.doc, tabId);
  return svg == null ? notFound() : svgImage(svg, SHARE_IMAGE_CACHE);
}

async function shareCard(ctx: RouteContext, code: string): Promise<Response> {
  const subject = await previewSubject(ctx, code);
  if (!subject) return notFound();
  const body: SharePreviewResponse = { name: subject.doc.name };
  return json(body);
}

// The brand card, on the origin the request came in on (the router serves it beside the api).
function brandCard(url: URL): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(BRAND_CARD_PATH, url.origin).toString(),
      'Cache-Control': BRAND_CARD_REDIRECT_CACHE,
    },
  });
}

async function shareCardImage(ctx: RouteContext, code: string): Promise<Response> {
  const { env, url } = ctx;
  const subject = await previewSubject(ctx, code);
  if (!subject) return notFound();
  const { doc, tabId } = subject;
  // A tab-scoped link's card is drawn per request, as its tab's live image is: one object per document holds the
  // first tab only.
  const key = tabId !== null ? null : shareCardKey(doc.id);
  const images = env.IMAGES;
  if (key && images) {
    const cached = await images.get(key);
    if (cached && Number(cached.customMetadata?.renderedAt ?? 0) >= doc.savedAt) {
      return pngImage(cached.body, SHARE_CARD_CACHE);
    }
  }
  // Stamped before the drawing is read, so a save landing mid-render leaves the stored card stale, never fresh.
  const drawnAt = Date.now();
  const svg = await documentImageSvg(env, doc, tabId);
  if (svg == null) return brandCard(url);
  let png: Uint8Array | null;
  try {
    png = await shareCardPng(svg);
  } catch (err) {
    console.warn('[share-card] render failed', { documentId: doc.id, error: String(err) });
    return brandCard(url);
  }
  if (png === null) {
    console.warn('[share-card] drawing has no sized root', { documentId: doc.id });
    return brandCard(url);
  }
  if (key && images) {
    const write = images
      .put(key, png, {
        httpMetadata: { contentType: 'image/png' },
        customMetadata: { renderedAt: String(drawnAt) },
      })
      .catch((err: unknown) => {
        // Best effort: the card is still served; the next preview draws it again.
        console.warn('[share-card] cache write failed', { documentId: doc.id, error: String(err) });
      });
    ctx.waitUntil?.(write);
  }
  return pngImage(png, SHARE_CARD_CACHE);
}
