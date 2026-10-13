// How a page's picture is painted (docs/specs/007-editor/illustrate-pages.md "Image backgrounds"):
// its overlay and crop as CSS layers for the sheet, and as SVG for the exports, so the canvas and
// the files paint it the same. Pure.
import {
  pageImageOverlayColor,
  pageImageTone,
  type PageImageFill,
  type PageImageOverlay,
  type PageImagePosition,
} from '@livediagram/document';
import { xmlEscape } from '@livediagram/icons';

const r2 = (n: number) => Math.round(n * 100) / 100;

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** The overlay as one CSS image layer: a flat wash, or a Fade clear at the top. */
export function pageImageOverlayCss(overlay: PageImageOverlay): string {
  const rgb = rgbOf(pageImageOverlayColor(overlay));
  const at = (a: number) => `rgb(${rgb} / ${r2(a)})`;
  return overlay.kind === 'fade'
    ? `linear-gradient(180deg, ${at(0)}, ${at(overlay.strength)})`
    : `linear-gradient(${at(overlay.strength)}, ${at(overlay.strength)})`;
}

/** The CSS `background-position` of a picture cropped to cover: centred across, its kept band down. */
export function pageImagePositionCss(position: PageImagePosition | undefined): string {
  return position === 'top' ? 'center top' : position === 'bottom' ? 'center bottom' : 'center';
}

// A source safe inside `url("...")`: a blob URL, an inline raster, or an https thumbnail; never
// anything carrying a quote, a backslash or a line break.
const CSS_SAFE = /^(?:blob:|data:image\/(?:png|jpeg|gif|webp);base64,|https:\/\/)[^"\\\n\r]*$/;

/** The picture's CSS `url()`, or null for a source that is not safe to put there. */
export function pageImageCssUrl(src: string): string | null {
  return CSS_SAFE.test(src) ? `url("${src}")` : null;
}

/** The source a page's picture paints from now: a hovered result's thumbnail, an offline document's
 *  inline bytes, or the gallery picture's fetched blob URL (`resolve`), once it has one. */
export function pageImageSrc(
  fill: PageImageFill,
  resolve?: (imageId: string) => string | undefined,
): string | undefined {
  if (fill.preview) return fill.preview;
  if (fill.imageId.startsWith('data:')) return fill.imageId;
  return resolve?.(fill.imageId);
}

/**
 * The page's picture as SVG in canvas coordinates: its tone, the picture cropped to cover the rect
 * (when its bytes are at hand as `href`), then its overlay. Ids are prefixed with `id`.
 */
export function pageImageSvg(
  fill: PageImageFill,
  rect: { x: number; y: number; width: number; height: number },
  href: string | undefined,
  id: string,
): string {
  const box = `x="${r2(rect.x)}" y="${r2(rect.y)}" width="${r2(rect.width)}" height="${r2(rect.height)}"`;
  // Under it all, the picture's tone: what shows where its bytes cannot be read.
  const parts = [`<rect ${box} fill="${xmlEscape(pageImageTone({ tone: fill.tone }))}"/>`];
  if (href) {
    const align =
      fill.position === 'top' ? 'xMidYMin' : fill.position === 'bottom' ? 'xMidYMax' : 'xMidYMid';
    parts.push(`<image ${box} href="${xmlEscape(href)}" preserveAspectRatio="${align} slice"/>`);
  }
  const o = fill.overlay;
  if (o) {
    const colour = xmlEscape(pageImageOverlayColor(o));
    if (o.kind === 'fade') {
      parts.push(
        `<defs><linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${colour}" stop-opacity="0"/>` +
          `<stop offset="1" stop-color="${colour}" stop-opacity="${r2(o.strength)}"/>` +
          `</linearGradient></defs>`,
        `<rect ${box} fill="url(#${id}-fade)"/>`,
      );
    } else {
      parts.push(`<rect ${box} fill="${colour}" fill-opacity="${r2(o.strength)}"/>`);
    }
  }
  return parts.join('');
}
