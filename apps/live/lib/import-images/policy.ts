// The encoding decisions of the import image pipeline, pure
// (docs/specs/020-import-export/import-image-pipeline.md "The encoding policy").

import { MAX_IMAGE_BYTES } from '@livediagram/api-schema';
import {
  IMPORT_IMAGE_MAX_EDGE_PX,
  IMPORT_IMAGE_SVG_DEFAULT_EDGE_PX,
  IMPORT_IMAGE_SVG_RASTER_SCALE,
} from './constants';
import type { DisplayHint } from './types';

export type EncodingPlan =
  { action: 'keep' } | { action: 'encode'; width: number; height: number; keepIfSmaller: boolean };

type PlanInput = {
  mimeType: string;
  width: number;
  height: number;
  byteLength: number;
  hint?: DisplayHint;
};

const scaled = (side: number, scale: number) => Math.max(1, Math.round(side * scale));

export function planImageEncoding({
  mimeType,
  width,
  height,
  byteLength,
  hint,
}: PlanInput): EncodingPlan {
  if (mimeType === 'image/svg+xml') return planSvg(width, height, hint);

  const longest = Math.max(width, height);
  const fits = longest <= IMPORT_IMAGE_MAX_EDGE_PX;
  const underCap = byteLength <= MAX_IMAGE_BYTES;

  // GIF keeps its animation and WebP skips a second lossy pass.
  if ((mimeType === 'image/gif' || mimeType === 'image/webp') && fits && underCap) {
    return { action: 'keep' };
  }
  const scale = fits ? 1 : IMPORT_IMAGE_MAX_EDGE_PX / longest;
  return {
    action: 'encode',
    width: scaled(width, scale),
    height: scaled(height, scale),
    keepIfSmaller: fits && (mimeType === 'image/png' || mimeType === 'image/jpeg'),
  };
}

// Vector: rasterise at twice the larger of its own size and the box it fills,
// capped; the aspect comes from the SVG, else the box, else square.
function planSvg(width: number, height: number, hint: DisplayHint | undefined): EncodingPlan {
  const intrinsic = Math.max(width, height);
  const hinted = hint ? Math.max(hint.width, hint.height) : 0;
  const larger = Math.max(intrinsic, hinted);
  const edge =
    larger > 0
      ? Math.min(IMPORT_IMAGE_MAX_EDGE_PX, larger * IMPORT_IMAGE_SVG_RASTER_SCALE)
      : IMPORT_IMAGE_SVG_DEFAULT_EDGE_PX;
  const aspect =
    width > 0 && height > 0
      ? width / height
      : hint && hint.width > 0 && hint.height > 0
        ? hint.width / hint.height
        : 1;
  return aspect >= 1
    ? { action: 'encode', width: edge, height: scaled(edge, 1 / aspect), keepIfSmaller: false }
    : { action: 'encode', width: scaled(edge, aspect), height: edge, keepIfSmaller: false };
}

// When the browser cannot encode WebP: JPEG stays JPEG, anything that may
// carry transparency goes to PNG.
export function fallbackOutputType(sourceMime: string): 'image/jpeg' | 'image/png' {
  return sourceMime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}
