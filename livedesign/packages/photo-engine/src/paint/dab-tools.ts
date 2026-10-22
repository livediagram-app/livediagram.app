// The tools that change the pixels under each dab from the pixels already there
// (docs/specs/031-photo/photo-tools.md "Focus and tone", "Painting and erasing"): Blur, Sharpen,
// Smudge, Dodge, Burn, Sponge and the Background Eraser. Unlike a stroke they build on themselves
// dab by dab, as Photoshop's do, each dab weighted by the tip, the strength and the selection; Dodge and
// Burn do not: like Photoshop's they lighten or darken a pixel at most by the exposure in one stroke,
// however many dabs pass over it, working from its colour before the stroke.
import { hslToRgb, rgbToHsl } from '../colour/colour';
import type { Point } from '../model/types';
import type { Mask8 } from '../raster/mask';
import { unionRects, type Rect } from '../raster/raster';
import { floodSelect } from '../select/flood';
import { TiledRaster } from '../raster/tiles';
import type { BrushSettings, StrokePoint } from './stroke';
import { tipFor, tipOrigin } from './tip';

export type ToneRange = 'shadows' | 'midtones' | 'highlights';

export type DabTool =
  | { kind: 'blur'; strength: number }
  | { kind: 'sharpen'; strength: number; protectDetail: boolean }
  | { kind: 'smudge'; strength: number; fingerColour?: readonly [number, number, number] }
  | { kind: 'dodge' | 'burn'; range: ToneRange; exposure: number; protectTones: boolean }
  | { kind: 'sponge'; saturate: boolean; flow: number; vibrance: boolean }
  | {
      kind: 'background-eraser';
      tolerance: number;
      continuous: boolean;
      contiguous: boolean;
      protect?: readonly [number, number, number];
    };

/** A level (0..1) dodged (lightened) or burned (darkened) by `amount` (0..1): a gamma curve, so black and
 *  white stay put and the colours between move, never toward grey. */
export function toneCurve(v: number, amount: number, dodge: boolean): number {
  if (v <= 0 || v >= 1 || amount <= 0) return v;
  const gamma = 1 + amount * TONE_GAMMA;
  return dodge ? v ** (1 / gamma) : v ** gamma;
}

// How far full exposure bends the curve: 1 + this is the gamma at 100% (Photoshop-like strength).
const TONE_GAMMA = 1.2;

// The side of a square of pixels whose colour before the stroke Dodge and Burn remember.
const TONE_TILE = 64;

/** How much a tone range takes of a level (0..1). */
export function toneWeight(range: ToneRange, v: number): number {
  if (range === 'shadows') return Math.max(0, 1 - v * 2) ** 1.2;
  if (range === 'highlights') return Math.max(0, v * 2 - 1) ** 1.2;
  return 1 - Math.abs(v - 0.5) * 2;
}

export class DabToolEngine {
  private readonly raster: TiledRaster;
  private readonly offset: Point;
  private readonly selection: Mask8 | null;
  private readonly brush: BrushSettings;
  private readonly tool: DabTool;
  private last: StrokePoint | null = null;
  private carry = 0;
  private touched: Rect | null = null;
  // Smudge's carried colour (per tip pixel) and the Background Eraser's sampled colour.
  private carried: Float32Array | null = null;
  private sampled: [number, number, number] | null = null;
  // Dodge and Burn: each touched square's pixels as they were before the stroke, and the strongest dab weight each
  // has had, so a stroke never builds past its exposure. Only the squares the stroke reaches are kept.
  private toneTiles = new Map<number, { orig: Uint8ClampedArray; weight: Float32Array }>();

  constructor(
    target: { raster: TiledRaster; offset: Point; selection?: Mask8 | null },
    brush: BrushSettings,
    tool: DabTool,
  ) {
    this.raster = target.raster;
    this.offset = target.offset;
    this.selection = target.selection ?? null;
    this.brush = brush;
    this.tool = tool;
  }

  get bounds(): Rect | null {
    return this.touched;
  }

  begin(p: StrokePoint): Rect | null {
    this.last = p;
    this.carry = 0;
    this.toneTiles.clear();
    return this.dab(p);
  }

  to(p: StrokePoint): Rect | null {
    const from = this.last;
    if (!from) return this.begin(p);
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return null;
    const step = Math.max(1, this.brush.spacing * this.brush.size);
    let changed: Rect | null = null;
    let at = step - this.carry;
    while (at <= dist) {
      const t = at / dist;
      changed = unionRects(
        changed,
        this.dab({ x: from.x + dx * t, y: from.y + dy * t, pressure: p.pressure }),
      );
      at += step;
    }
    this.carry = dist - (at - step);
    this.last = p;
    return changed;
  }

  /** A pixel (layer px) as it was before the stroke and its strongest weight so far: the first touch remembers it
   *  from the dab's read (`d` at `si`), which is still the pixel as it was. */
  private toneAt(
    px: number,
    py: number,
    d: Uint8ClampedArray,
    si: number,
  ): { orig: Uint8ClampedArray; oi: number; weight: Float32Array; wi: number } {
    const tx = Math.floor(px / TONE_TILE);
    const ty = Math.floor(py / TONE_TILE);
    // Signed tile coordinates packed into one key (layers stay well inside ±2^20 tiles).
    const key = (ty + 2 ** 20) * 2 ** 21 + (tx + 2 ** 20);
    let tile = this.toneTiles.get(key);
    if (!tile) {
      tile = {
        orig: new Uint8ClampedArray(TONE_TILE * TONE_TILE * 4),
        weight: new Float32Array(TONE_TILE * TONE_TILE).fill(-1),
      };
      this.toneTiles.set(key, tile);
    }
    const wi = (py - ty * TONE_TILE) * TONE_TILE + (px - tx * TONE_TILE);
    const oi = wi * 4;
    if (tile.weight[wi]! < 0) {
      tile.orig[oi] = d[si]!;
      tile.orig[oi + 1] = d[si + 1]!;
      tile.orig[oi + 2] = d[si + 2]!;
      tile.orig[oi + 3] = d[si + 3]!;
      tile.weight[wi] = 0;
    }
    return { orig: tile.orig, oi, weight: tile.weight, wi };
  }

  private selAt(px: number, py: number): number {
    const s = this.selection;
    if (!s) return 1;
    const x = px - s.x;
    const y = py - s.y;
    return x < 0 || y < 0 || x >= s.width || y >= s.height ? 0 : s.data[y * s.width + x]! / 255;
  }

  private dab(p: StrokePoint): Rect | null {
    const size = this.brush.size;
    const cx = p.x - this.offset.x;
    const cy = p.y - this.offset.y;
    const tip = tipFor(
      size,
      this.brush.hardness,
      'round',
      false,
      cx - Math.floor(cx),
      cy - Math.floor(cy),
    );
    const o = tipOrigin(tip, cx, cy);
    const rect = { x: o.x, y: o.y, width: tip.size, height: tip.size };
    // Read a pixel more round the tip for the neighbourhood tools.
    const pad = 1;
    const src = this.raster.read({
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
    const sw = src.width;
    const out = this.raster.read(rect);
    const d = src.data;
    const tool = this.tool;
    const flow = this.brush.flow * (this.brush.pressureOpacity ? (p.pressure ?? 1) : 1);
    if (tool.kind === 'smudge' && !this.carried) {
      this.carried = new Float32Array(tip.size * tip.size * 4);
      for (let y = 0; y < tip.size; y++)
        for (let x = 0; x < tip.size; x++) {
          const si = ((y + pad) * sw + x + pad) * 4;
          const ci = (y * tip.size + x) * 4;
          for (let c = 0; c < 4; c++)
            this.carried[ci + c] =
              tool.fingerColour && c < 3
                ? tool.fingerColour[c]!
                : c === 3 && tool.fingerColour
                  ? 255
                  : d[si + c]!;
        }
    }
    if (tool.kind === 'background-eraser' && (!this.sampled || tool.continuous)) {
      const ci = ((Math.floor(tip.oy) + pad) * sw + Math.floor(tip.ox) + pad) * 4;
      this.sampled = [d[ci]!, d[ci + 1]!, d[ci + 2]!];
    }
    // Contiguous: only the like-coloured area joined to the tip's centre.
    let reach: Uint8Array | null = null;
    if (tool.kind === 'background-eraser' && tool.contiguous) {
      const f = floodSelect(src, Math.floor(tip.ox) + pad, Math.floor(tip.oy) + pad, {
        tolerance: tool.tolerance,
      });
      reach = f.data;
    }
    for (let y = 0; y < tip.size; y++)
      for (let x = 0; x < tip.size; x++) {
        if (reach && !reach[(y + pad) * sw + x + pad]) continue;
        const k =
          tip.data[y * tip.size + x]! *
          this.selAt(rect.x + x + this.offset.x, rect.y + y + this.offset.y);
        if (k <= 0) continue;
        const si = ((y + pad) * sw + x + pad) * 4;
        const oi = (y * tip.size + x) * 4;
        const a = d[si + 3]!;
        switch (tool.kind) {
          case 'blur':
          case 'sharpen': {
            let r = 0;
            let g = 0;
            let b = 0;
            let al = 0;
            for (let j = -1; j <= 1; j++)
              for (let i = -1; i <= 1; i++) {
                const ni = si + (j * sw + i) * 4;
                const na = d[ni + 3]!;
                r += d[ni]! * na;
                g += d[ni + 1]! * na;
                b += d[ni + 2]! * na;
                al += na;
              }
            if (al === 0) break;
            const mean = [r / al, g / al, b / al];
            const s = tool.strength * k;
            for (let c = 0; c < 3; c++) {
              const v = d[si + c]!;
              let next =
                tool.kind === 'blur' ? v + (mean[c]! - v) * s : v + (v - mean[c]!) * s * 1.5;
              if (tool.kind === 'sharpen' && tool.protectDetail) next = v + (next - v) * 0.6;
              out.data[oi + c] = next;
            }
            if (tool.kind === 'blur') out.data[oi + 3] = a + (al / 9 - a) * s;
            break;
          }
          case 'smudge': {
            const c0 = (y * tip.size + x) * 4;
            const s = tool.strength * k;
            const carried = this.carried!;
            for (let c = 0; c < 4; c++) {
              const v = d[si + c]!;
              out.data[oi + c] = v + (carried[c0 + c]! - v) * s;
              // The finger picks up what it passes over.
              carried[c0 + c] = carried[c0 + c]! + (v - carried[c0 + c]!) * (1 - tool.strength) * k;
            }
            break;
          }
          case 'dodge':
          case 'burn': {
            const { orig, oi: ti, weight, wi } = this.toneAt(rect.x + x, rect.y + y, d, si);
            const strongest = Math.max(weight[wi]!, k * flow);
            weight[wi] = strongest;
            const r = orig[ti]! / 255;
            const g = orig[ti + 1]! / 255;
            const b = orig[ti + 2]! / 255;
            const [h, sat, l] = rgbToHsl(r, g, b);
            const amount = toneWeight(tool.range, l) * tool.exposure * strongest;
            const dodge = tool.kind === 'dodge';
            if (tool.protectTones) {
              // Lightness alone moves: the hue and saturation stay as they were.
              const [nr, ng, nb] = hslToRgb(h, sat, toneCurve(l, amount, dodge));
              out.data[oi] = nr * 255;
              out.data[oi + 1] = ng * 255;
              out.data[oi + 2] = nb * 255;
            } else {
              out.data[oi] = toneCurve(r, amount, dodge) * 255;
              out.data[oi + 1] = toneCurve(g, amount, dodge) * 255;
              out.data[oi + 2] = toneCurve(b, amount, dodge) * 255;
            }
            break;
          }
          case 'sponge': {
            const [h, s, l] = rgbToHsl(d[si]! / 255, d[si + 1]! / 255, d[si + 2]! / 255);
            const amount = tool.flow * k * 0.25 * (tool.vibrance && tool.saturate ? 1 - s : 1);
            const ns = Math.min(
              1,
              Math.max(0, tool.saturate ? s + (1 - s) * amount : s * (1 - amount)),
            );
            const [r, g, b] = hslToRgb(h, ns, l);
            out.data[oi] = r * 255;
            out.data[oi + 1] = g * 255;
            out.data[oi + 2] = b * 255;
            break;
          }
          case 'background-eraser': {
            const sc = this.sampled!;
            const diff = Math.max(
              Math.abs(d[si]! - sc[0]),
              Math.abs(d[si + 1]! - sc[1]),
              Math.abs(d[si + 2]! - sc[2]),
            );
            if (diff > tool.tolerance) break;
            if (tool.protect) {
              const pd = Math.max(
                Math.abs(d[si]! - tool.protect[0]),
                Math.abs(d[si + 1]! - tool.protect[1]),
                Math.abs(d[si + 2]! - tool.protect[2]),
              );
              if (pd <= tool.tolerance / 2) break;
            }
            out.data[oi + 3] = a * (1 - k * (1 - diff / (tool.tolerance + 1)));
            break;
          }
        }
      }
    this.raster.write(out, rect.x, rect.y);
    const photoRect = {
      x: rect.x + this.offset.x,
      y: rect.y + this.offset.y,
      width: rect.width,
      height: rect.height,
    };
    this.touched = unionRects(this.touched, photoRect);
    return photoRect;
  }
}
