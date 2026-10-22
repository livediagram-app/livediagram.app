// How a page's picture is painted (docs/specs/007-editor/pages-mode.md "Image backgrounds"):
// its overlay and crop as CSS layers for the sheet, and as SVG for the exports, so the canvas and
// the files paint it the same. Pure.
import {
  pageImageOverlayColor,
  type PageImageFill,
  type PageImageOverlay,
  type PageImagePosition,
} from '@livepages/document';

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

// The picture as SVG for the exports and previews (@livepages/document's page-frame.ts).
export { pageImageSvg } from '@livepages/document';
