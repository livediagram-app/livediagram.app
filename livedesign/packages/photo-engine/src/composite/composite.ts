// The composite (docs/specs/031-photo/photo-layers.md "The stack and the composite"): a photo's
// layers drawn bottom to top over a rect of the photo, on the CPU. Exact, and the reference the GPU
// compositor is held to; exports and previews draw with it.
import { adjustmentForm, applyForm, type AdjustmentForm } from '../adjust/catalogue';
import { blendChannel, blendRgb, blendSpan, isSeparable } from '../colour/blend';
import { hexToBytes } from '../colour/colour';
import { fillGradientLine, renderGradient } from '../paint/gradient';
import type { BlendMode, PhotoLayer, TextLayer } from '../model/types';
import { createRaster, cropRaster, solidRaster, type Raster, type Rect } from '../raster/raster';
import type { TiledRaster } from '../raster/tiles';
import { effectsMargin, hasEffects, withEffects } from './effects';

export type PixelsLookup = {
  /** A pixel layer's pixels, in layer coordinates. */
  layer(id: string): TiledRaster | undefined;
  /** A layer's mask's pixels, in mask coordinates. */
  mask(id: string): TiledRaster | undefined;
};

/** Draws a text layer over `rect` (photo coordinates); the host's, since text needs fonts. */
export type TextRasterizer = (layer: TextLayer, rect: Rect) => Raster | undefined;

export type CompositeOptions = {
  text?: TextRasterizer;
  // Layers drawn as given in place of the stored ones (a setting being previewed).
  overrides?: ReadonlyMap<string, PhotoLayer>;
  // Show this layer alone (Alt+press on its eye).
  solo?: string;
  // The adjustment forms already worked out, by layer id (the session's cache).
  forms?: Map<string, AdjustmentForm>;
};

type Node = { layer: PhotoLayer; children: Node[] };

/** The stack as a tree, each list bottom first. */
export function layerTree(layers: readonly PhotoLayer[]): Node[] {
  const nodes = new Map<string, Node>(layers.map((l) => [l.id, { layer: l, children: [] }]));
  const roots: Node[] = [];
  for (const l of layers) {
    const node = nodes.get(l.id)!;
    const parent = l.parent ? nodes.get(l.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// A stable hash in [0, 1) of a layer and a pixel's place: Dissolve's pattern holds still and is the
// same on every client (docs/specs/031-photo/blueprints/DEFAULTS.md D5).
export function dissolveSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dissolveNoise(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const offsetOf = (l: PhotoLayer) =>
  l.layerKind === 'pixel' && l.offset ? l.offset : { x: 0, y: 0 };

class Compositor {
  private readonly width: number;
  private readonly height: number;
  private readonly pixels: PixelsLookup;
  private readonly opts: CompositeOptions;

  constructor(width: number, height: number, pixels: PixelsLookup, opts: CompositeOptions) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
    this.opts = opts;
  }

  private visible(l: PhotoLayer): boolean {
    return l.visible !== false;
  }

  /** The layer's mask over `rect` (photo coordinates), or undefined when it has none showing. */
  private maskOver(l: PhotoLayer, rect: Rect): Uint8Array | undefined {
    if (!l.mask || l.mask.enabled === false) return undefined;
    const tiles = this.pixels.mask(l.id);
    const at = l.mask.linked === false ? (l.mask.offset ?? { x: 0, y: 0 }) : offsetOf(l);
    const r = { x: rect.x - at.x, y: rect.y - at.y, width: rect.width, height: rect.height };
    if (!tiles) {
      // A mask whose pixels are not loaded reads as showing everything.
      return undefined;
    }
    return tiles.readChannel(r, 0);
  }

  /** A layer's own picture over `rect`, effects and mask included, before its blend. */
  private content(node: Node, rect: Rect): Raster {
    const l = node.layer;
    let out: Raster;
    switch (l.layerKind) {
      case 'pixel': {
        const margin = hasEffects(l.effects) ? effectsMargin(l.effects) : 0;
        const at = offsetOf(l);
        const tiles = this.pixels.layer(l.id);
        const wide = {
          x: rect.x - margin - at.x,
          y: rect.y - margin - at.y,
          width: rect.width + margin * 2,
          height: rect.height + margin * 2,
        };
        const raw = tiles ? tiles.read(wide) : createRaster(wide.width, wide.height);
        out =
          margin > 0
            ? cropRaster(withEffects(raw, l.effects), {
                x: margin,
                y: margin,
                width: rect.width,
                height: rect.height,
              })
            : raw;
        break;
      }
      case 'fill': {
        if (l.fill.kind === 'solid') {
          const [r, g, b] = hexToBytes(l.fill.colour);
          out = solidRaster(rect.width, rect.height, [r, g, b, 255]);
        } else {
          const f = l.fill;
          const { from, to } = fillGradientLine(this.width, this.height, f.angle, f.scale, f.style);
          out = renderGradient(f.gradient, f.style, from, to, rect, {
            reverse: f.reverse === true,
          });
        }
        break;
      }
      case 'text': {
        const margin = hasEffects(l.effects) ? effectsMargin(l.effects) : 0;
        const wide = {
          x: rect.x - margin,
          y: rect.y - margin,
          width: rect.width + margin * 2,
          height: rect.height + margin * 2,
        };
        const raw = this.opts.text?.(l, wide) ?? createRaster(wide.width, wide.height);
        out =
          margin > 0
            ? cropRaster(withEffects(raw, l.effects), {
                x: margin,
                y: margin,
                width: rect.width,
                height: rect.height,
              })
            : raw;
        break;
      }
      case 'group': {
        out = createRaster(rect.width, rect.height);
        this.list(node.children, out, rect);
        break;
      }
      case 'adjustment':
        return createRaster(rect.width, rect.height);
    }
    const mask = this.maskOver(l, rect);
    if (mask)
      for (let i = 0; i < mask.length; i++)
        out.data[i * 4 + 3] = (out.data[i * 4 + 3]! * mask[i]!) / 255;
    return out;
  }

  private form(l: PhotoLayer & { layerKind: 'adjustment' }): AdjustmentForm {
    const cached = this.opts.forms?.get(l.id);
    if (cached) return cached;
    const f = adjustmentForm(l.adjustment);
    this.opts.forms?.set(l.id, f);
    return f;
  }

  /** An adjustment layer onto `acc`: colour changed, alpha kept, mixed by mask and opacity. */
  private adjust(l: PhotoLayer & { layerKind: 'adjustment' }, acc: Raster, rect: Rect): void {
    const form = this.form(l);
    if (form.kind === 'identity') return;
    const adj = createRaster(acc.width, acc.height);
    adj.data.set(acc.data);
    applyForm(adj, form);
    const mask = this.maskOver(l, rect);
    const opacity = l.opacity ?? 1;
    mixColour(acc, adj, l.blend ?? 'normal', opacity, mask);
  }

  /** One layer (not clipped) onto `acc`. */
  private draw(node: Node, acc: Raster, rect: Rect): void {
    const l = node.layer;
    if (l.layerKind === 'adjustment') return this.adjust(l, acc, rect);
    if (l.layerKind === 'group' && (l.blend ?? 'pass-through') === 'pass-through') {
      const through = createRaster(acc.width, acc.height);
      through.data.set(acc.data);
      this.list(node.children, through, rect);
      const mask = this.maskOver(l, rect);
      lerpInto(acc, through, l.opacity ?? 1, mask);
      return;
    }
    const content = this.content(node, rect);
    blendLayer(acc, content, l, rect);
  }

  /** A list of sibling layers onto `acc`, bottom first, with clipping runs. */
  list(nodes: readonly Node[], acc: Raster, rect: Rect): void {
    let i = 0;
    while (i < nodes.length) {
      const base = nodes[i]!;
      const clipped: Node[] = [];
      let j = i + 1;
      while (j < nodes.length && nodes[j]!.layer.clip) clipped.push(nodes[j++]!);
      i = j;
      if (!this.visible(base.layer)) continue;
      if (clipped.length === 0 || base.layer.layerKind === 'adjustment') {
        this.draw(base, acc, rect);
        for (const c of clipped) if (this.visible(c.layer)) this.draw(c, acc, rect);
        continue;
      }
      // Clipped layers blend as a group with their base (DEFAULTS D14).
      const t = this.content(base, rect);
      const alpha = new Uint8ClampedArray(t.width * t.height);
      for (let k = 0; k < alpha.length; k++) alpha[k] = t.data[k * 4 + 3]!;
      for (const c of clipped) {
        if (!this.visible(c.layer)) continue;
        if (c.layer.layerKind === 'adjustment') {
          this.adjust(c.layer, t, rect);
          continue;
        }
        if (c.layer.layerKind === 'group' && (c.layer.blend ?? 'pass-through') === 'pass-through') {
          const through = createRaster(t.width, t.height);
          through.data.set(t.data);
          this.list(c.children, through, rect);
          lerpInto(t, through, c.layer.opacity ?? 1, this.maskOver(c.layer, rect));
        } else blendLayer(t, this.content(c, rect), c.layer, rect);
        for (let k = 0; k < alpha.length; k++) t.data[k * 4 + 3] = alpha[k]!;
      }
      blendLayer(acc, t, base.layer, rect);
    }
  }
}

/** `content` blended onto `acc` by the layer's mode and opacity (Dissolve by its pattern). */
function blendLayer(acc: Raster, content: Raster, l: PhotoLayer, rect: Rect): void {
  const mode = l.blend ?? 'normal';
  const opacity = l.opacity ?? 1;
  if (mode === 'dissolve') {
    const seed = dissolveSeed(l.id);
    const d = content.data;
    for (let y = 0; y < content.height; y++)
      for (let x = 0; x < content.width; x++) {
        const i = (y * content.width + x) * 4 + 3;
        const a = (d[i]! / 255) * opacity;
        d[i] = dissolveNoise(seed, rect.x + x, rect.y + y) < a ? 255 : 0;
      }
    blendSpan(acc.data, 0, d, 0, acc.width * acc.height, 'normal', 1);
    return;
  }
  blendSpan(acc.data, 0, content.data, 0, acc.width * acc.height, mode, opacity);
}

/** `acc` moved toward `next` (every channel) by opacity times the mask. */
function lerpInto(acc: Raster, next: Raster, opacity: number, mask?: Uint8Array): void {
  const a = acc.data;
  const b = next.data;
  for (let p = 0; p < acc.width * acc.height; p++) {
    const k = opacity * (mask ? mask[p]! / 255 : 1);
    if (k <= 0) continue;
    const i = p * 4;
    if (k >= 1) {
      a[i] = b[i]!;
      a[i + 1] = b[i + 1]!;
      a[i + 2] = b[i + 2]!;
      a[i + 3] = b[i + 3]!;
      continue;
    }
    // Mix premultiplied, so a transparent side carries no colour.
    const aa = a[i + 3]! / 255;
    const ba = b[i + 3]! / 255;
    const oa = aa + (ba - aa) * k;
    if (oa <= 0) {
      a[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) a[i + c] = (a[i + c]! * aa * (1 - k) + b[i + c]! * ba * k) / oa;
    a[i + 3] = oa * 255;
  }
}

/** The adjusted colours mixed into `acc` by the adjustment layer's mode, opacity and mask, alpha
 *  kept (DEFAULTS D15). */
function mixColour(
  acc: Raster,
  adj: Raster,
  mode: BlendMode,
  opacity: number,
  mask?: Uint8Array,
): void {
  const a = acc.data;
  const b = adj.data;
  const separable = isSeparable(mode);
  for (let p = 0; p < acc.width * acc.height; p++) {
    const k = opacity * (mask ? mask[p]! / 255 : 1);
    const i = p * 4;
    if (k <= 0 || a[i + 3] === 0) continue;
    const br = a[i]! / 255;
    const bg = a[i + 1]! / 255;
    const bb = a[i + 2]! / 255;
    let sr = b[i]! / 255;
    let sg = b[i + 1]! / 255;
    let sb = b[i + 2]! / 255;
    if (mode !== 'normal' && mode !== 'dissolve' && mode !== 'pass-through') {
      if (separable) {
        sr = blendChannel(mode, br, sr)!;
        sg = blendChannel(mode, bg, sg)!;
        sb = blendChannel(mode, bb, sb)!;
      } else [sr, sg, sb] = blendRgb(mode, [br, bg, bb], [sr, sg, sb]);
    }
    a[i] = (br + (sr - br) * k) * 255;
    a[i + 1] = (bg + (sg - bg) * k) * 255;
    a[i + 2] = (bb + (sb - bb) * k) * 255;
  }
}

/** Every layer hidden but `id`, the groups it is in, and what is inside it. */
/** The stack with only `id` (and its groups and, for a group, its layers) shown: Alt+press on an
 *  eye. */
export function soloed(layers: readonly PhotoLayer[], id: string): PhotoLayer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const keep = new Set<string>([id]);
  for (let at = byId.get(id)?.parent; at && !keep.has(at); at = byId.get(at)?.parent) keep.add(at);
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    if (l.parent && keep.has(l.parent) && (l.parent === id || isInside(byId, l.parent, id)))
      keep.add(l.id);
  }
  return layers.map((l) => (keep.has(l.id) ? l : { ...l, visible: false as const }));
}

function isInside(byId: Map<string, PhotoLayer>, at: string, group: string): boolean {
  for (let cur: string | undefined = at; cur; cur = byId.get(cur)?.parent)
    if (cur === group) return true;
  return false;
}

/** The composite of `rect` (photo coordinates; clamped to nothing, so a rect past the photo's edges
 *  draws the layers there too). */
export function compositePhoto(
  photo: { width: number; height: number; layers: readonly PhotoLayer[] },
  pixels: PixelsLookup,
  rect: Rect,
  opts: CompositeOptions = {},
): Raster {
  let layers = opts.overrides
    ? photo.layers.map((l) => opts.overrides!.get(l.id) ?? l)
    : photo.layers;
  if (opts.solo) layers = soloed(layers, opts.solo);
  const acc = createRaster(rect.width, rect.height);
  new Compositor(photo.width, photo.height, pixels, opts).list(layerTree(layers), acc, rect);
  return acc;
}

/** The whole photo's composite. */
export function compositeAll(
  photo: { width: number; height: number; layers: readonly PhotoLayer[] },
  pixels: PixelsLookup,
  opts: CompositeOptions = {},
): Raster {
  return compositePhoto(
    photo,
    pixels,
    { x: 0, y: 0, width: photo.width, height: photo.height },
    opts,
  );
}
