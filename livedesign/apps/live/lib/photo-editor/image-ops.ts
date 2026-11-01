// Changing the photo's size and turning it (docs/specs/031-photo/photo-pages.md "Changing the
// size"): Image Size, Canvas Size, Rotate, Flip, Crop and Trim Transparent. Each reworks every pixel
// layer and mask whole and moves the other layers to match, as one edit.
import {
  alphaBounds,
  apply,
  canvasShift,
  compositeAll,
  createRaster,
  flipRaster,
  hexToBytes,
  PHOTO_MAX_AREA,
  PHOTO_PIXEL_CAP,
  PHOTO_PIXEL_CAP_COARSE,
  resizeRaster,
  rotate as rotateMatrix,
  rotateQuarter,
  chain,
  translate,
  TiledRaster,
  transformRaster,
  type Anchor,
  type Interpolation,
  type Photo,
  type PhotoLayer,
  type QuarterTurn,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';
import { coarsePointer } from './coarse-pointer';
import { photoWorkers } from './photo-worker-client';
import type { PhotoSession } from './session';
import { rasterizeText, textBox } from './text-raster';

export function pixelCap(): number {
  return coarsePointer() ? PHOTO_PIXEL_CAP_COARSE : PHOTO_PIXEL_CAP;
}

/** Why a size is refused, if it is. */
export function sizeRefused(width: number, height: number): string | null {
  const cap = pixelCap();
  if (width < 1 || height < 1) return 'A photo needs at least one pixel each way.';
  if (width > cap || height > cap) return `Photos can be up to ${cap} px on a side.`;
  if (width * height > PHOTO_MAX_AREA) return 'That photo would have too many pixels.';
  return null;
}

type Placed = { raster: Raster; x: number; y: number };

/** A raster's whole picture (its tiles' extent) and where it sits in the photo. */
function picture(r: TiledRaster, offset: { x: number; y: number }): Placed | null {
  const b = r.contentBounds();
  if (!b) return null;
  return { raster: r.read(b), x: b.x + offset.x, y: b.y + offset.y };
}

const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

type Point = { x: number; y: number };

/** A text layer's place after a turn or a flip (photo-pages.md "Changing the size"): upright still, its box
 *  moved so its centre lands where `to` takes that part of the picture. */
const textFollows =
  (to: (p: Point) => Point) =>
  (l: PhotoLayer): PhotoLayer => {
    if (l.layerKind !== 'text') return l;
    const b = textBox(l);
    const c = to({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    const at = { x: Math.round(c.x - b.width / 2), y: Math.round(c.y - b.height / 2) };
    return { ...l, text: { ...l.text, at } };
  };

/** Reworks every pixel layer's and mask's whole picture with `map` (photo px in, photo px out) and
 *  every other layer's place with `move`, then commits it all with the photo's new size. */
function rework(
  s: PhotoSession,
  label: string,
  size: { width: number; height: number },
  map: (p: Placed, kind: 'layer' | 'mask', layerId: string) => Placed | null,
  move: (layer: PhotoLayer) => PhotoLayer,
  // Last touches to the reworked pixels before the commit, given where each pixel layer now sits.
  finish?: (offsets: ReadonlyMap<string, { x: number; y: number }>) => void,
): void {
  const targets: { layerId: string; target: 'layer' | 'mask'; dropSource: true }[] = [];
  const offsets = new Map<string, { x: number; y: number }>();
  for (const l of s.photo.layers) {
    if (l.layerKind === 'pixel') {
      const p = picture(s.raster(l.id), offsetOf(l));
      const next = p ? map(p, 'layer', l.id) : null;
      // A layer's pixels sit at its origin; its offset carries where.
      const t = next ? TiledRaster.fromRaster(next.raster) : new TiledRaster();
      s.replacePixels(l.id, 'layer', t);
      offsets.set(l.id, next ? { x: next.x, y: next.y } : { x: 0, y: 0 });
      targets.push({ layerId: l.id, target: 'layer', dropSource: true });
    }
    if (l.mask) {
      const at = l.mask.linked === false ? (l.mask.offset ?? { x: 0, y: 0 }) : offsetOf(l);
      // A mask's white beyond its tiles: worked as a grey picture of its tiles' extent.
      const p = picture(s.raster(l.id, 'mask'), at);
      const next = p ? map(p, 'mask', l.id) : null;
      const t = new TiledRaster(1, 255);
      if (next) {
        // What a turn or a crop left empty is the mask's white, not black.
        const d = next.raster.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!;
          if (a < 255) d[i] = (d[i]! * a + 255 * (255 - a)) / 255;
        }
        // Written relative to where the layer now sits.
        const base =
          l.mask.linked === false ? { x: 0, y: 0 } : (offsets.get(l.id) ?? { x: 0, y: 0 });
        t.write(next.raster, next.x - base.x, next.y - base.y);
      }
      s.replacePixels(l.id, 'mask', t);
      targets.push({ layerId: l.id, target: 'mask', dropSource: true });
    }
  }
  finish?.(offsets);
  // Each layer's new place worked out once, from the photo as it is now: the commit applies it again
  // when its tiles land, and a text layer's move is relative, so the stack edit must hold if applied
  // twice.
  const placed = new Map(
    s.photo.layers.map((l) => {
      const moved = move(l);
      const at = offsets.get(l.id);
      if (moved.layerKind === 'pixel' && at) {
        const { offset: _o, ...rest } = moved;
        void _o;
        return [l.id, at.x || at.y ? { ...rest, offset: at } : rest];
      }
      return [l.id, moved];
    }),
  );
  const stack = (photo: Photo): Photo => ({
    ...photo,
    width: size.width,
    height: size.height,
    layers: photo.layers.map((l) => placed.get(l.id) ?? l),
  });
  // Shown at once, so an edit made before the tiles land (a second turn) starts from the new size.
  s.preview(stack(s.photo));
  s.commitPixels(label, targets, stack);
}

/** Image Size: every layer resampled to the new size. */
export function imageSize(
  s: PhotoSession,
  width: number,
  height: number,
  how: Interpolation,
): string | null {
  const refused = sizeRefused(width, height);
  if (refused) return refused;
  const sx = width / s.photo.width;
  const sy = height / s.photo.height;
  rework(
    s,
    'Image Size',
    { width, height },
    (p) => {
      const w = Math.max(1, Math.round(p.raster.width * sx));
      const h = Math.max(1, Math.round(p.raster.height * sy));
      return {
        raster: resizeRaster(p.raster, w, h, how),
        x: Math.round(p.x * sx),
        y: Math.round(p.y * sy),
      };
    },
    (l) =>
      l.layerKind === 'text'
        ? {
            ...l,
            text: {
              ...l.text,
              size: Math.min(2000, Math.max(4, l.text.size * sy)),
              at: { x: Math.round(l.text.at.x * sx), y: Math.round(l.text.at.y * sy) },
              ...(l.text.boxWidth ? { boxWidth: l.text.boxWidth * sx } : {}),
            },
          }
        : l,
  );
  return null;
}

/** Canvas Size: the photo grown or cropped about the anchor; new pixels on the bottom layer take the
 *  fill (transparent when null). */
export function canvasSize(
  s: PhotoSession,
  width: number,
  height: number,
  anchor: Anchor,
  fill: string | null,
): string | null {
  const refused = sizeRefused(width, height);
  if (refused) return refused;
  const { dx, dy } = canvasShift(s.photo, { width, height }, anchor);
  const bottom = s.photo.layers.find((l) => l.layerKind === 'pixel' && !l.parent);
  const old = { width: s.photo.width, height: s.photo.height };
  rework(
    s,
    'Canvas Size',
    { width, height },
    (p) => ({ raster: p.raster, x: p.x + dx, y: p.y + dy }),
    (l) =>
      l.layerKind === 'text'
        ? { ...l, text: { ...l.text, at: { x: l.text.at.x + dx, y: l.text.at.y + dy } } }
        : l,
    (offsets) => {
      if (!fill || !bottom) return;
      // The bottom layer's new area filled; the old canvas left as it was.
      const [r, g, b] = hexToBytes(fill);
      const raster = s.raster(bottom.id);
      const o = offsets.get(bottom.id) ?? { x: 0, y: 0 };
      const area = createRaster(width, height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const inside = x >= dx && y >= dy && x < dx + old.width && y < dy + old.height;
          if (!inside) area.data.set([r, g, b, 255], (y * width + x) * 4);
        }
      const existing = raster.read({ x: -o.x, y: -o.y, width, height });
      for (let i = 0; i < existing.data.length; i += 4)
        if (existing.data[i + 3]) area.data.set(existing.data.subarray(i, i + 4), i);
      raster.write(area, -o.x, -o.y);
    },
  );
  return null;
}

/** How a photo fills another size (photo-pages.md "Making sizes"): scaled by the larger of the two
 *  scales so it covers the size, then placed about the centre. */
export function coverPlan(
  from: { width: number; height: number },
  to: { width: number; height: number },
): { k: number; dx: number; dy: number } {
  const k = Math.max(to.width / from.width, to.height / from.height);
  return {
    k,
    dx: Math.round((to.width - from.width * k) / 2),
    dy: Math.round((to.height - from.height * k) / 2),
  };
}

export type Resample = (r: Raster, width: number, height: number) => Promise<Raster>;

/** Bicubic resampling in the photo worker (on the page where a worker cannot start). */
export const workerResample: Resample = async (raster, width, height) => {
  const res = await photoWorkers().run({ kind: 'resize', raster, width, height }).result;
  if (res.kind !== 'resize') throw new Error('resize failed');
  return res.raster;
};

/** Make Sizes' one step: Image Size by the cover scale, then Canvas Size about the centre, every layer
 *  reworked once. The pixels past the new edges are kept, so the Move tool can choose another crop.
 *  Each layer's and mask's picture is resampled off the main thread first (blueprint "Make Sizes"),
 *  so a large photo never holds the page for a whole size. */
export async function coverSize(
  s: PhotoSession,
  width: number,
  height: number,
  resample: Resample = workerResample,
): Promise<string | null> {
  const refused = sizeRefused(width, height);
  if (refused) return refused;
  const { k, dx, dy } = coverPlan(s.photo, { width, height });
  const scaled = new Map<string, Raster>();
  const scale = async (key: string, r: TiledRaster) => {
    const b = r.contentBounds();
    if (!b) return;
    const w = Math.max(1, Math.round(b.width * k));
    const h = Math.max(1, Math.round(b.height * k));
    scaled.set(key, await resample(r.read(b), w, h));
  };
  for (const l of s.photo.layers) {
    if (l.layerKind === 'pixel') await scale(`${l.id}:layer`, s.raster(l.id));
    if (l.mask) await scale(`${l.id}:mask`, s.raster(l.id, 'mask'));
  }
  rework(
    s,
    'Make Sizes',
    { width, height },
    // Every picture rework reads was resampled above: the same bounds, so the same key.
    (p, kind, id) => ({
      raster: scaled.get(`${id}:${kind}`)!,
      x: Math.round(p.x * k) + dx,
      y: Math.round(p.y * k) + dy,
    }),
    (l) =>
      l.layerKind === 'text'
        ? {
            ...l,
            text: {
              ...l.text,
              size: Math.min(2000, Math.max(4, l.text.size * k)),
              at: { x: Math.round(l.text.at.x * k) + dx, y: Math.round(l.text.at.y * k) + dy },
              ...(l.text.boxWidth ? { boxWidth: l.text.boxWidth * k } : {}),
            },
          }
        : l,
  );
  return null;
}

/** Rotate by a quarter turn, two or three. */
export function rotateQuarterTurn(s: PhotoSession, turn: QuarterTurn): void {
  const { width: W, height: H } = s.photo;
  const size = turn === 180 ? { width: W, height: H } : { width: H, height: W };
  rework(
    s,
    turn === 180
      ? 'Rotate 180°'
      : turn === 90
        ? 'Rotate 90° Clockwise'
        : 'Rotate 90° Anticlockwise',
    size,
    (p) => {
      const r = rotateQuarter(p.raster, turn);
      // The picture's box turned about the photo.
      const x0 = p.x;
      const y0 = p.y;
      const x1 = p.x + p.raster.width;
      const y1 = p.y + p.raster.height;
      if (turn === 90) return { raster: r, x: H - y1, y: x0 };
      if (turn === 180) return { raster: r, x: W - x1, y: H - y1 };
      return { raster: r, x: y0, y: W - x1 };
    },
    textFollows(({ x, y }) =>
      turn === 90 ? { x: H - y, y: x } : turn === 180 ? { x: W - x, y: H - y } : { x: y, y: W - x },
    ),
  );
}

/** Flip horizontally or vertically. */
export function flipImage(s: PhotoSession, horizontal: boolean): void {
  const { width: W, height: H } = s.photo;
  rework(
    s,
    horizontal ? 'Flip Horizontal' : 'Flip Vertical',
    { width: W, height: H },
    (p) => ({
      raster: flipRaster(p.raster, horizontal),
      x: horizontal ? W - (p.x + p.raster.width) : p.x,
      y: horizontal ? p.y : H - (p.y + p.raster.height),
    }),
    textFollows(({ x, y }) => (horizontal ? { x: W - x, y } : { x, y: H - y })),
  );
}

/** Rotate by any angle (degrees clockwise), the canvas growing to hold the turned photo. */
export function rotateAny(s: PhotoSession, degrees: number): string | null {
  const { width: W, height: H } = s.photo;
  const rad = (degrees * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const sn = Math.abs(Math.sin(rad));
  const nw = Math.ceil(W * c + H * sn);
  const nh = Math.ceil(W * sn + H * c);
  const refused = sizeRefused(nw, nh);
  if (refused) return refused;
  // Photo px to new photo px: about the old centre, onto the new centre.
  const m = chain(translate(-W / 2, -H / 2), rotateMatrix(rad), translate(nw / 2, nh / 2));
  rework(
    s,
    'Rotate',
    { width: nw, height: nh },
    (p) => {
      const out = transformRaster(p.raster, chain(translate(p.x, p.y), m), 'bicubic');
      return out ? { raster: out.raster, x: out.x, y: out.y } : null;
    },
    textFollows((p) => apply(m, p)),
  );
  return null;
}

/** Crop to a rect of the photo (at an angle, its content turned level). Pixels outside are dropped
 *  when `deletePixels`, else kept past the new edges. */
export function cropTo(s: PhotoSession, rect: Rect, angle = 0, deletePixels = true): string | null {
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const refused = sizeRefused(w, h);
  if (refused) return refused;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const m = angle
    ? chain(translate(-cx, -cy), rotateMatrix((-angle * Math.PI) / 180), translate(w / 2, h / 2))
    : translate(-Math.round(rect.x), -Math.round(rect.y));
  rework(
    s,
    'Crop',
    { width: w, height: h },
    (p) => {
      let placed: Placed | null;
      if (angle) {
        const out = transformRaster(p.raster, chain(translate(p.x, p.y), m), 'bicubic');
        placed = out ? { raster: out.raster, x: out.x, y: out.y } : null;
      } else
        placed = { raster: p.raster, x: p.x - Math.round(rect.x), y: p.y - Math.round(rect.y) };
      if (!placed || !deletePixels) return placed;
      // Only what lies inside the new photo.
      const x0 = Math.max(0, placed.x);
      const y0 = Math.max(0, placed.y);
      const x1 = Math.min(w, placed.x + placed.raster.width);
      const y1 = Math.min(h, placed.y + placed.raster.height);
      if (x1 <= x0 || y1 <= y0) return null;
      const out = createRaster(x1 - x0, y1 - y0);
      for (let y = y0; y < y1; y++) {
        const from = ((y - placed.y) * placed.raster.width + (x0 - placed.x)) * 4;
        out.data.set(
          placed.raster.data.subarray(from, from + (x1 - x0) * 4),
          (y - y0) * out.width * 4,
        );
      }
      return { raster: out, x: x0, y: y0 };
    },
    (l) =>
      l.layerKind === 'text'
        ? {
            ...l,
            text: {
              ...l.text,
              at: { x: l.text.at.x - Math.round(rect.x), y: l.text.at.y - Math.round(rect.y) },
            },
          }
        : l,
  );
  return null;
}

/** Trim Transparent: crop to the composite's non-transparent bounds. */
export function trimTransparent(s: PhotoSession): string | null {
  const all = compositeAll(s.photo, s.lookup(), { text: rasterizeText });
  const b = alphaBounds(all);
  if (!b) return 'The photo is empty: nothing to trim to.';
  if (b.x === 0 && b.y === 0 && b.width === s.photo.width && b.height === s.photo.height)
    return 'Nothing to trim.';
  return cropTo(s, b, 0, true);
}
