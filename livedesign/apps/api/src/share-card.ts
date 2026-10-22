// The share card (docs/specs/013-workspace/share-link-previews.md): a link's live-image drawing fitted onto the
// 1200 x 630 frame every link preview (Slack, Teams, Discord, iMessage, X, LinkedIn) draws at full width. Pure, so
// the fit is tested without the rasteriser; share-card-png.ts turns the result into a PNG.

import type { Rect } from '@livedesign/document';

// The Open Graph card size. Every preview surface takes 1.91:1 and draws this at full width.
export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;
// The drawing's breathing room on every side, so no preview's rounded corners clip it.
export const SHARE_CARD_MARGIN = 48;
// How much a small drawing (one box, one sticky) may grow to fill the card. Past twice its size a single shape
// reads as a blown-up blob rather than a document. Safe range: 1 to 4.
export const SHARE_CARD_MAX_UPSCALE = 2;
// The card's paper when the drawing names none it can be filled with (transparent, a pattern).
const FALLBACK_BACKGROUND = '#ffffff';

const ROOT_SVG = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg\b([^>]*)>/i;
// The root attributes the card sets itself; every other one (xmlns, fill, font) is kept.
const PLACEMENT_ATTRS = /\s(?:x|y|width|height|viewBox|preserveAspectRatio)="[^"]*"/g;

function attr(attrs: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
}

function length(attrs: string, name: string): number | null {
  const value = Number.parseFloat(attr(attrs, name) ?? '');
  return Number.isFinite(value) && value > 0 ? value : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// The colour the drawing paints its own paper in: the renderer's first element is a full-bleed rect.
function backgroundOf(body: string): string {
  const fill = /^\s*<rect\b[^>]*\sfill="([^"]+)"/.exec(body)?.[1];
  if (!fill || fill === 'none' || fill === 'transparent' || fill.startsWith('url(')) {
    return FALLBACK_BACKGROUND;
  }
  return fill;
}

type ShareCardFit = Rect;

// Where a drawing of `width` x `height` sits on the card: as large as the margins allow, never past the upscale
// cap, centred.
export function shareCardFit(width: number, height: number): ShareCardFit {
  const scale = Math.min(
    (SHARE_CARD_WIDTH - SHARE_CARD_MARGIN * 2) / width,
    (SHARE_CARD_HEIGHT - SHARE_CARD_MARGIN * 2) / height,
    SHARE_CARD_MAX_UPSCALE,
  );
  const w = width * scale;
  const h = height * scale;
  return {
    x: r2((SHARE_CARD_WIDTH - w) / 2),
    y: r2((SHARE_CARD_HEIGHT - h) / 2),
    width: r2(w),
    height: r2(h),
  };
}

// The drawing nested inside the card: its root tag placed and sized, its viewBox kept, on its own paper. Null when
// the input has no sized root <svg>, which no renderer this worker uses ever produces.
export function shareCardSvg(svg: string): string | null {
  const root = ROOT_SVG.exec(svg);
  if (!root) return null;
  const attrs = root[1]!;
  const width = length(attrs, 'width');
  const height = length(attrs, 'height');
  if (width === null || height === null) return null;
  const viewBox = attr(attrs, 'viewBox') ?? `0 0 ${width} ${height}`;
  const body = svg.slice(root.index + root[0].length);
  const fit = shareCardFit(width, height);
  const placed =
    `<svg${attrs.replace(PLACEMENT_ATTRS, '')} x="${fit.x}" y="${fit.y}" width="${fit.width}" ` +
    `height="${fit.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" ` +
    `viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">` +
    `<rect width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" fill="${backgroundOf(body)}"/>` +
    placed +
    body +
    '</svg>'
  );
}
