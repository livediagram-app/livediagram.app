// The Drive thumbnail (docs/specs/022-drive-mirror/drive-mirror.md, "The file"): Drive
// takes PNG, GIF or JPEG only, at least 220 px wide and under 2 MB, so the
// document's existing SVG snapshot is rasterised to PNG in the browser and sent
// as `contentHints.thumbnail`.

import { bytesToBase64Url } from '@livediagram/api-schema';
import {
  DRIVE_THUMBNAIL_MAX_BYTES,
  DRIVE_THUMBNAIL_MIN_WIDTH_PX,
  DRIVE_THUMBNAIL_WIDTH_PX,
} from './cadence';

// Turns an SVG into URL-safe base64 PNG, or null when it cannot.
export type Rasteriser = (svg: string) => Promise<string | null>;

// The SVG's aspect ratio from its viewBox (or width / height), 4:3 when it
// names neither.
export function svgAspect(svg: string): number {
  const viewBox = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  const w = Number(viewBox?.[1] ?? /\swidth="([\d.]+)/.exec(svg)?.[1]);
  const h = Number(viewBox?.[2] ?? /\sheight="([\d.]+)/.exec(svg)?.[1]);
  return w > 0 && h > 0 ? w / h : 4 / 3;
}

// The widths to try, largest first: halving until the PNG fits under 2 MB,
// never below Drive's 220 px floor.
export function thumbnailWidths(start = DRIVE_THUMBNAIL_WIDTH_PX): number[] {
  const out: number[] = [];
  for (let w = start; w >= DRIVE_THUMBNAIL_MIN_WIDTH_PX; w = Math.floor(w / 2)) out.push(w);
  if (out.at(-1) !== DRIVE_THUMBNAIL_MIN_WIDTH_PX) out.push(DRIVE_THUMBNAIL_MIN_WIDTH_PX);
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('thumbnail: svg did not load'));
    img.src = url;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// The browser implementation.
export const rasteriseSvgToPng: Rasteriser = async (svg) => {
  const aspect = svgAspect(svg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    for (const width of thumbnailWidths()) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(1, Math.round(width / aspect));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToPng(canvas);
      if (blob && blob.size <= DRIVE_THUMBNAIL_MAX_BYTES) {
        return bytesToBase64Url(await blob.arrayBuffer());
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};
