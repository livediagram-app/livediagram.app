// Share-link previews (docs/specs/013-workspace/share-link-previews.md): the two doors a link preview reads.
//
//   GET /api/share/<code>/card       { name } for the live app's worker, which writes it into the share page's head;
//   GET /api/share/<code>/image.png  the share card, a 1200 x 630 PNG of the link's live-image drawing.
//
// Both answer exactly where the live image (GET /api/share/<code>/image.svg) answers, so a preview never says more
// about a link than its image already does: an unknown, revoked or expired code, a trashed design, a design with a
// share password are all 404.

import { BRAND_CARD_PATH, type SharePreviewResponse } from '@livedesign/api-schema';
import {
  getDesignSharePassword,
  getDesignThumbMeta,
  getShareLink,
  shareCardKey,
  type DesignThumbMeta,
} from '../db';
import { designImageSvg } from '../design-image';
import { json, notFound, pngImage } from '../responses';
import { shareCardPng } from '../share-card-png';
import type { RouteContext } from './context';

// A link's card changes only when its design is saved, and a chat app keeps its own copy for far longer, so a
// few minutes fresh and an hour stale costs nothing in accuracy.
export const SHARE_CARD_CACHE = 'public, max-age=300, stale-while-revalidate=3600';
// The brand card stands in for a design with nothing to draw yet; short, so its first drawing shows soon after.
export const BRAND_CARD_REDIRECT_CACHE = 'public, max-age=300';

type PreviewSubject = { doc: DesignThumbMeta; tabId: string | null };

// The one gate both doors share: the live image's rules, in the live image's order.
async function previewSubject(
  env: RouteContext['env'],
  code: string,
): Promise<PreviewSubject | null> {
  const link = await getShareLink(env, code);
  if (!link) return null;
  // A trashed design reads as missing here.
  const doc = await getDesignThumbMeta(env, link.designId);
  if (!doc) return null;
  if (await getDesignSharePassword(env, doc.id)) return null;
  return { doc, tabId: link.tabId };
}

// `api/share/<code>/card` and `.../image.png`, as the worker splits them. The share rate limiter keys these apart
// from the share resolve, so a room of people opening one link never spends the editor's budget on previews.
export function isSharePreviewPath(segments: readonly string[]): boolean {
  return (
    segments.length === 4 &&
    segments[1] === 'share' &&
    (segments[3] === 'card' || segments[3] === 'image.png')
  );
}

// Null for every path this module does not own, so the share router falls through to its own answers.
export async function handleSharePreview(ctx: RouteContext): Promise<Response | null> {
  const { request, segments } = ctx;
  if (!isSharePreviewPath(segments) || request.method !== 'GET') return null;
  return segments[3] === 'card' ? shareCard(ctx, segments[2]!) : shareCardImage(ctx, segments[2]!);
}

async function shareCard(ctx: RouteContext, code: string): Promise<Response> {
  const subject = await previewSubject(ctx.env, code);
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
  const subject = await previewSubject(env, code);
  if (!subject) return notFound();
  const { doc, tabId } = subject;
  // A tab-scoped link's card is drawn per request, as its tab's live image is: one object per design holds the
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
  const svg = await designImageSvg(env, doc, tabId, { defer: ctx.waitUntil });
  if (svg == null) return brandCard(url);
  let png: Uint8Array | null;
  try {
    png = await shareCardPng(svg);
  } catch (err) {
    console.warn('[share-card] render failed', { designId: doc.id, error: String(err) });
    return brandCard(url);
  }
  if (png === null) {
    console.warn('[share-card] drawing has no sized root', { designId: doc.id });
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
        console.warn('[share-card] cache write failed', { designId: doc.id, error: String(err) });
      });
    ctx.waitUntil?.(write);
  }
  return pngImage(png, SHARE_CARD_CACHE);
}
