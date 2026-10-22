// A painting stroke (docs/specs/031-photo/photo-tools.md "Painting and erasing"): dabs of the tip laid
// along the pointer's path at the brush's spacing, accumulated into the stroke's own coverage by the
// flow, capped by the opacity, and drawn onto the layer as they come from the pixels the layer had
// when the stroke began, so a stroke never builds on itself past its opacity. The Brush, Pencil,
// Eraser, Clone Stamp and Heal's copy, and painting on a mask, are all strokes.
import { behindSpan, blendSpan, clearSpan } from '../colour/blend';
import { tileKey } from '../model/ids';
import { PHOTO_TILE } from '../model/limits';
import type { BlendMode, Point } from '../model/types';
import type { Mask8 } from '../raster/mask';
import { unionRects, type Rect } from '../raster/raster';
import { TiledRaster } from '../raster/tiles';
import { tipFor, tipOrigin, type TipShape } from './tip';

export type StrokePoint = { x: number; y: number; pressure?: number };

export type BrushSettings = {
  // Diameter, px.
  size: number;
  // 0..1.
  hardness: number;
  opacity: number;
  flow: number;
  // The distance between dabs as a share of the size.
  spacing: number;
  shape?: TipShape;
  aliased?: boolean;
  pressureSize?: boolean;
  pressureOpacity?: boolean;
};

export type StrokeMode =
  | {
      kind: 'paint';
      colour: readonly [number, number, number];
      blend: BlendMode | 'behind' | 'clear';
    }
  | { kind: 'erase' }
  // Copies from `source` (layer coordinates) displaced by `offset` (source = here + offset).
  | { kind: 'clone'; source: TiledRaster; offset: Point }
  // Grey painted on a mask: 0 hides, 255 shows.
  | { kind: 'mask'; value: number };

export type StrokeTarget = {
  raster: TiledRaster;
  // Where the layer's origin sits in the photo (layer = photo - offset).
  offset: Point;
  // The selection, in photo coordinates; absent is everything.
  selection?: Mask8 | null;
  // The layer's transparency is locked: colour changes, alpha stays.
  lockAlpha?: boolean;
};

const T = PHOTO_TILE;

export class StrokeEngine {
  private readonly target: StrokeTarget;
  private readonly brush: BrushSettings;
  private readonly mode: StrokeMode;
  private readonly base: TiledRaster;
  private readonly cover = new Map<string, Float32Array>();
  private pending: Rect | null = null;
  private last: StrokePoint | null = null;
  // Distance walked since the last dab.
  private carry = 0;
  private dabs = 0;
  private touched: Rect | null = null;

  constructor(target: StrokeTarget, brush: BrushSettings, mode: StrokeMode) {
    this.target = target;
    this.brush = brush;
    this.mode = mode;
    this.base = target.raster.clone();
  }

  /** The dabs laid so far. */
  get dabCount(): number {
    return this.dabs;
  }

  /** Everything the stroke has changed, in photo coordinates. */
  get bounds(): Rect | null {
    return this.touched;
  }

  /** The layer as the stroke began. */
  get original(): TiledRaster {
    return this.base;
  }

  private sizeAt(p: StrokePoint): number {
    const pressure = p.pressure ?? 1;
    return Math.max(1, this.brush.size * (this.brush.pressureSize ? Math.max(0.05, pressure) : 1));
  }

  /** The stroke's first dab. */
  begin(p: StrokePoint): Rect | null {
    this.last = p;
    this.carry = 0;
    this.dab(p);
    return this.flush();
  }

  /** The stroke continued to `p`: dabs along the way. Answers what changed (photo coordinates). */
  to(p: StrokePoint): Rect | null {
    const from = this.last;
    if (!from) return this.begin(p);
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return null;
    let at = 0;
    for (;;) {
      const t0 = at / dist;
      const here = {
        x: from.x + dx * t0,
        y: from.y + dy * t0,
        pressure: lerp(from.pressure ?? 1, p.pressure ?? 1, t0),
      };
      const step = Math.max(0.5, this.brush.spacing * this.sizeAt(here));
      const need = step - this.carry;
      if (at + need > dist) {
        this.carry += dist - at;
        break;
      }
      at += need;
      this.carry = 0;
      const t = at / dist;
      this.dab({
        x: from.x + dx * t,
        y: from.y + dy * t,
        pressure: lerp(from.pressure ?? 1, p.pressure ?? 1, t),
      });
    }
    this.last = p;
    return this.flush();
  }

  /** The stroke ended. Answers what the last part changed. */
  end(): Rect | null {
    return this.flush();
  }

  private dab(p: StrokePoint): void {
    const size = this.sizeAt(p);
    // Layer coordinates.
    const aliased = this.brush.aliased ?? false;
    // An even aliased tip centres on the nearest pixel corner (tipFor).
    const snap = aliased && Math.round(size) % 2 === 0;
    const cx = snap ? Math.round(p.x - this.target.offset.x) : p.x - this.target.offset.x;
    const cy = snap ? Math.round(p.y - this.target.offset.y) : p.y - this.target.offset.y;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const tip = tipFor(
      size,
      this.brush.hardness,
      this.brush.shape ?? 'round',
      aliased,
      cx - ix,
      cy - iy,
    );
    const origin = tipOrigin(tip, cx, cy);
    const pressure = p.pressure ?? 1;
    const strength = this.brush.flow * (this.brush.pressureOpacity ? pressure : 1);
    const rect = { x: origin.x, y: origin.y, width: tip.size, height: tip.size };
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const key = tileKey(col, row);
      let c = this.cover.get(key);
      if (!c) {
        c = new Float32Array(T * T);
        this.cover.set(key, c);
      }
      const x0 = Math.max(rect.x, col * T);
      const y0 = Math.max(rect.y, row * T);
      const x1 = Math.min(rect.x + rect.width, (col + 1) * T);
      const y1 = Math.min(rect.y + rect.height, (row + 1) * T);
      for (let y = y0; y < y1; y++) {
        const ti = (y - origin.y) * tip.size;
        const ci = (y - row * T) * T - col * T;
        for (let x = x0; x < x1; x++) {
          const a = tip.data[ti + x - origin.x]! * strength;
          if (a <= 0) continue;
          const k = ci + x;
          c[k] = c[k]! + (1 - c[k]!) * a;
        }
      }
    }
    this.dabs++;
    this.pending = unionRects(this.pending, rect);
  }

  /** Draws the pending area from the original pixels and the coverage. */
  private flush(): Rect | null {
    const rect = this.pending;
    if (!rect) return null;
    this.pending = null;
    const { raster, offset, selection, lockAlpha } = this.target;
    const channels = raster.channels;
    const opacity = this.brush.opacity;
    const mode = this.mode;
    const rowCov = new Uint8Array(T);
    const rowSrc = new Uint8ClampedArray(T * 4);
    if (mode.kind === 'paint')
      for (let i = 0; i < T; i++) {
        rowSrc[i * 4] = mode.colour[0];
        rowSrc[i * 4 + 1] = mode.colour[1];
        rowSrc[i * 4 + 2] = mode.colour[2];
        rowSrc[i * 4 + 3] = 255;
      }
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const key = tileKey(col, row);
      const cover = this.cover.get(key);
      if (!cover) continue;
      const dest = raster.writable(col, row);
      const baseTile = this.base.peek(col, row);
      const baseFill = this.base.sample(col * T, row * T, 0);
      const x0 = Math.max(rect.x, col * T);
      const y0 = Math.max(rect.y, row * T);
      const x1 = Math.min(rect.x + rect.width, (col + 1) * T);
      const y1 = Math.min(rect.y + rect.height, (row + 1) * T);
      const n = x1 - x0;
      for (let y = y0; y < y1; y++) {
        const ty = y - row * T;
        const tx0 = x0 - col * T;
        let any = false;
        for (let i = 0; i < n; i++) {
          let a = cover[ty * T + tx0 + i]! * opacity;
          if (a > 0 && selection) {
            const sx = x0 + i + offset.x - selection.x;
            const sy = y + offset.y - selection.y;
            a *=
              sx < 0 || sy < 0 || sx >= selection.width || sy >= selection.height
                ? 0
                : selection.data[sy * selection.width + sx]! / 255;
          }
          rowCov[i] = a * 255 + 0.5;
          if (rowCov[i]) any = true;
        }
        if (!any) continue;
        if (channels === 1) {
          const at = ty * T + tx0;
          const value = mode.kind === 'mask' ? mode.value : mode.kind === 'erase' ? 0 : 255;
          for (let i = 0; i < n; i++) {
            const b = baseTile ? baseTile[at + i]! : baseFill;
            dest[at + i] = b + ((value - b) * rowCov[i]!) / 255;
          }
          continue;
        }
        const at = (ty * T + tx0) * 4;
        // Start from the original pixels.
        if (baseTile) dest.set(baseTile.subarray(at, at + n * 4), at);
        else dest.fill(0, at, at + n * 4);
        if (mode.kind === 'erase') {
          clearSpan(dest, at, n, 1, rowCov);
        } else if (mode.kind === 'paint') {
          const blend = mode.blend;
          if (blend === 'clear') clearSpan(dest, at, n, 1, rowCov);
          else if (blend === 'behind') behindSpan(dest, at, rowSrc, 0, n, 1, rowCov);
          else blendSpan(dest, at, rowSrc, 0, n, blend, 1, rowCov);
        } else if (mode.kind === 'clone') {
          const src = mode.source.read({
            x: x0 + mode.offset.x,
            y: y + mode.offset.y,
            width: n,
            height: 1,
          });
          blendSpan(dest, at, src.data, 0, n, 'normal', 1, rowCov);
        }
        if (lockAlpha && baseTile)
          for (let i = 0; i < n; i++) dest[at + i * 4 + 3] = baseTile[at + i * 4 + 3]!;
        else if (lockAlpha) for (let i = 0; i < n; i++) dest[at + i * 4 + 3] = 0;
      }
    }
    const photoRect = {
      x: rect.x + offset.x,
      y: rect.y + offset.y,
      width: rect.width,
      height: rect.height,
    };
    this.touched = unionRects(this.touched, photoRect);
    return photoRect;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
