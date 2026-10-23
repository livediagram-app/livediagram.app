// Rasterize Into Layer (docs/specs/031-photo/photo-pages.md "A photo page" Elements on top): an
// element on a photo page drawn into pixels at the photo's resolution, as the page's export draws
// it, so a new layer can take it. Only the element's own box (with room for its stroke and shadow)
// is drawn, so a large photo never needs a canvas its whole size.
import { elementBounds, type Element, type LaidOutPage, type Tab } from '@livedesign/design';
import type { Raster } from '@livedesign/photo-engine';
import { renderTabToSvg } from '../export-tab';

// Room past the element's box for its stroke, arrowheads and shadow, in canvas px.
export const RASTERIZE_MARGIN = 16;

function svgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('rasterize failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** The element's box in the photo's px, clamped to the photo. */
export function elementPhotoRect(
  el: Element,
  elements: Element[],
  page: Pick<LaidOutPage, 'rect'>,
  photo: { width: number; height: number },
): { x: number; y: number; width: number; height: number } | null {
  const b = elementBounds(el, elements);
  const k = photo.width / page.rect.width;
  const x0 = Math.max(0, Math.floor((b.x - RASTERIZE_MARGIN - page.rect.x) * k));
  const y0 = Math.max(0, Math.floor((b.y - RASTERIZE_MARGIN - page.rect.y) * k));
  const x1 = Math.min(photo.width, Math.ceil((b.x + b.width + RASTERIZE_MARGIN - page.rect.x) * k));
  const y1 = Math.min(
    photo.height,
    Math.ceil((b.y + b.height + RASTERIZE_MARGIN - page.rect.y) * k),
  );
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** The element's pixels and where they sit in the photo; null when it lies off the photo. */
export async function elementPixels(
  tab: Tab,
  el: Element,
  page: LaidOutPage,
  photo: { width: number; height: number },
): Promise<{ raster: Raster; x: number; y: number } | null> {
  const rect = elementPhotoRect(el, tab.elements, page, photo);
  if (!rect) return null;
  const svg = renderTabToSvg({ ...tab, elements: [el] }, { page, transparentPaper: true });
  const img = await svgImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // The whole page drawn at the photo's size, shifted so the element's box is the canvas.
  ctx.drawImage(img, -rect.x, -rect.y, photo.width, photo.height);
  const data = ctx.getImageData(0, 0, rect.width, rect.height).data;
  return { raster: { width: rect.width, height: rect.height, data }, x: rect.x, y: rect.y };
}
