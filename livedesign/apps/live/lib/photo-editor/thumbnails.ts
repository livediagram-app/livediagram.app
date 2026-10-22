// A layer's thumbnail for the Layers tab (docs/specs/031-photo/photo-layers.md "The Layers tab"): its
// pixels (or its mask's) over the whole photo, sampled to the thumbnail's size, nearest pixel, in
// this thread (32 px rows: a few thousand samples each).
import type { Raster } from '@livedesign/photo-engine';
import type { PhotoSession } from './session';

export const THUMB_SIDE = 32;

/** The thumbnail's size for a photo: its shape within a THUMB_SIDE square. */
export function thumbSize(photo: { width: number; height: number }, side = THUMB_SIDE) {
  const k = side / Math.max(photo.width, photo.height);
  return {
    width: Math.max(1, Math.round(photo.width * k)),
    height: Math.max(1, Math.round(photo.height * k)),
  };
}

export function layerThumbnail(
  s: PhotoSession,
  layerId: string,
  target: 'layer' | 'mask',
  side = THUMB_SIDE,
): Raster | null {
  const layer = s.layer(layerId);
  if (!layer) return null;
  if (target === 'layer' && layer.layerKind !== 'pixel') return null;
  if (target === 'mask' && !layer.mask) return null;
  const { width: W, height: H } = s.photo;
  const size = thumbSize(s.photo, side);
  const o =
    target === 'mask' && layer.mask?.linked === false
      ? (layer.mask.offset ?? { x: 0, y: 0 })
      : layer.layerKind === 'pixel'
        ? (layer.offset ?? { x: 0, y: 0 })
        : { x: 0, y: 0 };
  const raster = s.raster(layerId, target);
  const out = {
    width: size.width,
    height: size.height,
    data: new Uint8ClampedArray(size.width * size.height * 4),
  };
  for (let y = 0; y < size.height; y++)
    for (let x = 0; x < size.width; x++) {
      const px = Math.floor(((x + 0.5) / size.width) * W) - o.x;
      const py = Math.floor(((y + 0.5) / size.height) * H) - o.y;
      const i = (y * size.width + x) * 4;
      if (target === 'mask') {
        const v = raster.sample(px, py, 0);
        out.data[i] = v;
        out.data[i + 1] = v;
        out.data[i + 2] = v;
        out.data[i + 3] = 255;
      } else for (let c = 0; c < 4; c++) out.data[i + c] = raster.sample(px, py, c);
    }
  return out;
}
