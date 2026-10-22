// A layer mask from the selection (docs/specs/031-photo/photo-layers.md "Layer operations" Masks): the
// selection's grey over a rect of the photo, white beyond it. Shared by Add Mask and a new adjustment layer
// made with a selection. Pure.
import { TiledRaster, type Mask8, type Rect } from '@livedesign/photo-engine';

/** The selection's value at a photo px (0 outside it). */
export const selectionAt = (m: Mask8 | null, x: number, y: number): number => {
  if (!m) return 0;
  const mx = x - m.x;
  const my = y - m.y;
  return mx < 0 || my < 0 || mx >= m.width || my >= m.height ? 0 : m.data[my * m.width + mx]!;
};

/** Grey over `rect`, each px from `value`. */
export function greyOver(rect: Rect, value: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(rect.width * rect.height);
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) out[y * rect.width + x] = value(rect.x + x, rect.y + y);
  return out;
}

/** A mask showing the selection over `rect` (photo px; the layer's px sit `offset` from the photo's). */
export function selectionMaskRaster(
  selection: Mask8 | null,
  rect: Rect,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): TiledRaster {
  const mask = new TiledRaster(1, 255);
  mask.writeChannel(
    { x: rect.x - offset.x, y: rect.y - offset.y, width: rect.width, height: rect.height },
    greyOver(rect, (x, y) => selectionAt(selection, x, y)),
  );
  return mask;
}
