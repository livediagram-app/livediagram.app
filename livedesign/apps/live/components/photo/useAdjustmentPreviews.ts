'use client';

// The Adjust tab's tile pictures (lib/photo-editor/adjust-showcase): the photo, small, through each adjustment's
// showcase settings, as image URLs. Worked out from the preview-sized composite a moment after the photo last
// changed (the first at once), only while the tiles are on screen.
import { useEffect, useRef, useState } from 'react';
import {
  adjustmentForm,
  ADJUSTMENTS,
  applyForm,
  histogramOf,
  resizeRaster,
  type AdjustmentId,
  type Raster,
} from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { ADJUST_SHOWCASE } from '@/lib/photo-editor/adjust-showcase';
import { previewRaster } from '@/lib/photo-editor/preview';
import { HISTOGRAM_DELAY_MS } from './usePhotoHistogram';

// A tile picture's longer side, px (two tile widths, for sharp screens).
export const ADJUST_TILE_PX = 160;

/** Each adjustment's picture of the photo; `base` is the photo itself, unadjusted. */
export type AdjustPreviews = Partial<Record<AdjustmentId | 'base', string>>;

/** The small photo through each adjustment, as data URLs (no 2D canvas: none). */
export function adjustPreviewUrls(small: Raster, ids: readonly AdjustmentId[]): AdjustPreviews {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const g = canvas?.getContext('2d');
  if (!canvas || !g) return {};
  canvas.width = small.width;
  canvas.height = small.height;
  const url = (r: Raster) => {
    g.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
    return canvas.toDataURL('image/png');
  };
  const out: AdjustPreviews = { base: url(small) };
  const hist = histogramOf(small, 1);
  for (const id of ids) {
    const copy: Raster = {
      width: small.width,
      height: small.height,
      data: new Uint8ClampedArray(small.data),
    };
    const params = ADJUST_SHOWCASE[id] ?? ADJUSTMENTS[id].defaults;
    applyForm(copy, adjustmentForm({ id, params }, hist));
    out[id] = url(copy);
  }
  return out;
}

export function useAdjustmentPreviews(
  photo: PhotoEditorView,
  ids: readonly AdjustmentId[],
  on: boolean,
): AdjustPreviews {
  const [previews, setPreviews] = useState<AdjustPreviews>({});
  const worked = useRef(false);
  const s = photo.session;
  const v = photo.version;
  useEffect(() => {
    if (!s || !on) return;
    let live = true;
    const t = setTimeout(
      () => {
        void previewRaster(s.photo, s.lookup(), () => !live).then((r) => {
          if (!live || !r) return;
          const k = ADJUST_TILE_PX / Math.max(r.width, r.height);
          const small =
            k < 1
              ? resizeRaster(
                  r,
                  Math.max(1, Math.round(r.width * k)),
                  Math.max(1, Math.round(r.height * k)),
                  'bilinear',
                )
              : r;
          worked.current = true;
          setPreviews(adjustPreviewUrls(small, ids));
        });
      },
      worked.current ? HISTOGRAM_DELAY_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [s, v, on, ids]);
  return previews;
}
