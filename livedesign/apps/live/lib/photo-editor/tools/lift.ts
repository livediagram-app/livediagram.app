// Floating pixels (docs/specs/031-photo/photo-tools.md "Moving and transforming"): the selection's
// pixels lifted off a layer (or the whole layer's, with no selection), carried by a move or a
// transform, and put down onto the same layer as one edit. The layer is shown without them while
// they float; a cancel puts the layer back as it was.
import {
  blendOnto,
  chain,
  createMask,
  maskBounds,
  transformRaster,
  translate,
  type Mask8,
  type Matrix,
  type PixelLayer,
  type Raster,
  type Rect,
  type TiledRaster,
} from '@livedesign/photo-engine';
import type { PhotoSession } from '../session';
import { offsetOf } from './tool-context';

export type Lifted = {
  layerId: string;
  // The lifted picture and where its top-left sat in the photo.
  raster: Raster;
  x: number;
  y: number;
  // The selection it was lifted by (photo px), carried with it; null for a whole layer.
  selection: Mask8 | null;
  // The layer's pixels before the lift, for a cancel.
  before: TiledRaster;
};

const intersect = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return x1 > x && y1 > y ? { x, y, width: x1 - x, height: y1 - y } : null;
};

/** The selection's pixels of a pixel layer lifted off it (the layer keeps what the selection only
 *  partly covers, in part). Null when nothing is there to lift. */
export function lift(s: PhotoSession, layer: PixelLayer, selection: Mask8 | null): Lifted | null {
  const raster = s.raster(layer.id);
  const before = raster.clone();
  const o = offsetOf(layer);
  const tb = raster.contentBounds();
  if (!tb) return null;
  const extent = { x: tb.x + o.x, y: tb.y + o.y, width: tb.width, height: tb.height };
  const area = selection ? maskBounds(selection) : extent;
  const rect = area ? intersect(area, extent) : null;
  if (!rect) return null;
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const pic = raster.read(local);
  let any = false;
  if (selection) {
    const left = raster.read(local);
    for (let y = 0; y < rect.height; y++)
      for (let x = 0; x < rect.width; x++) {
        const mx = rect.x + x - selection.x;
        const my = rect.y + y - selection.y;
        const m =
          mx < 0 || my < 0 || mx >= selection.width || my >= selection.height
            ? 0
            : selection.data[my * selection.width + mx]!;
        const i = (y * rect.width + x) * 4 + 3;
        const a = pic.data[i]!;
        pic.data[i] = (a * m) / 255;
        left.data[i] = (a * (255 - m)) / 255;
        if (pic.data[i]) any = true;
      }
    if (!any) return null;
    raster.write(left, local.x, local.y);
  } else {
    for (let i = 3; i < pic.data.length; i += 4) if (pic.data[i]) any = true;
    if (!any) return null;
    raster.write(
      { width: rect.width, height: rect.height, data: new Uint8ClampedArray(pic.data.length) },
      local.x,
      local.y,
    );
  }
  s.changed();
  return { layerId: layer.id, raster: pic, x: rect.x, y: rect.y, selection, before };
}

/** A mask carried through `t` (photo px to photo px). */
function transformMask(m: Mask8, t: Matrix): Mask8 | null {
  const grey = new Uint8ClampedArray(m.width * m.height * 4);
  for (let i = 0; i < m.data.length; i++) {
    grey[i * 4] = 255;
    grey[i * 4 + 3] = m.data[i]!;
  }
  const out = transformRaster(
    { width: m.width, height: m.height, data: grey },
    chain(translate(m.x, m.y), t),
    'bilinear',
  );
  if (!out) return null;
  const next = createMask({
    x: out.x,
    y: out.y,
    width: out.raster.width,
    height: out.raster.height,
  });
  for (let i = 0; i < next.data.length; i++) next.data[i] = out.raster.data[i * 4 + 3]!;
  return next;
}

/** The floating pixels put down through `matrix` (a transform of the photo's px, the identity where
 *  they were lifted), one edit; the selection goes with them. */
export function putDown(
  s: PhotoSession,
  lifted: Lifted,
  matrix: Matrix,
  label: string,
  how: 'bicubic' | 'bilinear' | 'nearest' = 'bicubic',
): void {
  const layer = s.layer(lifted.layerId);
  if (!layer || layer.layerKind !== 'pixel') return;
  const isMove =
    matrix[0] === 1 &&
    matrix[1] === 0 &&
    matrix[3] === 0 &&
    matrix[4] === 1 &&
    !matrix[6] &&
    !matrix[7];
  const dx = matrix[2];
  const dy = matrix[5];
  // A whole-pixel move copies; anything else resamples once from the lifted pixels.
  const placed =
    isMove && Number.isInteger(dx) && Number.isInteger(dy)
      ? { raster: lifted.raster, x: lifted.x + dx, y: lifted.y + dy }
      : transformRaster(lifted.raster, chain(translate(lifted.x, lifted.y), matrix), how);
  const raster = s.raster(layer.id);
  const o = offsetOf(layer);
  if (placed) {
    const rect = {
      x: placed.x,
      y: placed.y,
      width: placed.raster.width,
      height: placed.raster.height,
    };
    const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
    const dst = raster.read(local);
    blendOnto(dst, rect, placed.raster, rect, 'normal', 1);
    raster.write(dst, local.x, local.y);
  }
  if (lifted.selection) {
    s.lastSelection = s.selection;
    s.selection = isMove
      ? {
          ...lifted.selection,
          x: lifted.selection.x + Math.round(dx),
          y: lifted.selection.y + Math.round(dy),
        }
      : transformMask(lifted.selection, matrix);
  }
  s.changed();
  s.commitPixels(label, [{ layerId: layer.id, target: 'layer' }]);
}

/** The lift undone: the layer as it was. */
export function dropLift(s: PhotoSession, lifted: Lifted): void {
  s.restorePixels(lifted.layerId, 'layer', lifted.before);
}
