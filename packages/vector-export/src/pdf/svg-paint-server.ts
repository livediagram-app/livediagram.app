// Gradients and patterns as PDF patterns (liveworkspace/docs/specs/013-export/vector-pdf.md "Paint"): a linear or radial gradient becomes a
// shading pattern (axial or radial, its stops a stitched function), a user-space tiling pattern a tiling pattern whose
// tile is drawn as vectors too. What PDF has no form for (translucent stops, reflected or repeated spreads, a tile in
// bounding-box units) is reported, so the element that uses it falls back to a picture.
import { multiply, num, translate, type Matrix } from './matrix';
import { byId, toBase, type SvgContext } from './svg-context';
import { parseColor, rgbOperands, type Rgba } from './svg-color';
import { styleOf } from './svg-style';
import { parseTransform, type Box } from './svg-transform';

function hrefOf(el: Element): string | null {
  const v = el.getAttribute('href') ?? el.getAttribute('xlink:href');
  return v?.startsWith('#') ? v.slice(1) : null;
}

/** The chain of paint servers an element inherits from by href, itself first (cycles cut). */
function chain(ctx: SvgContext, el: Element): Element[] {
  const out = [el];
  let id = hrefOf(el);
  while (id && out.length < 8) {
    const next = byId(ctx, id);
    if (!next || out.includes(next)) break;
    out.push(next);
    id = hrefOf(next);
  }
  return out;
}

const attrOf = (els: readonly Element[], name: string): string | null => {
  for (const e of els) {
    const v = e.getAttribute(name);
    if (v !== null) return v;
  }
  return null;
};

type Stop = { offset: number; color: Rgba };

function stopsOf(els: readonly Element[]): { stops: Stop[]; translucent: boolean } {
  const holder = els.find((e) => e.querySelector('stop')) ?? els[0]!;
  const stops: Stop[] = [];
  let translucent = false;
  let last = 0;
  for (const s of holder.querySelectorAll(':scope > stop')) {
    const raw = s.getAttribute('offset') ?? '0';
    let offset = raw.trim().endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
    offset = Math.min(1, Math.max(last, Number.isFinite(offset) ? offset : 0));
    last = offset;
    const style = styleOf(s);
    const color = parseColor(style('stop-color')) ?? { r: 0, g: 0, b: 0, a: 1 };
    const opacity = parseFloat(style('stop-opacity'));
    const a = color.a * (Number.isFinite(opacity) ? opacity : 1);
    if (a < 0.999) translucent = true;
    stops.push({ offset, color });
  }
  return { stops, translucent };
}

/** Why the paint server `id` can't be a PDF pattern, or null when it can (or doesn't exist: the paint falls back to
 *  its colour). */
export function paintServerProblem(ctx: SvgContext, id: string): string | null {
  const el = byId(ctx, id);
  if (!el) return null;
  if (el.localName === 'linearGradient' || el.localName === 'radialGradient') {
    const els = chain(ctx, el);
    const spread = attrOf(els, 'spreadMethod');
    if (spread && spread !== 'pad') return 'gradient spread';
    if (stopsOf(els).translucent) return 'translucent gradient';
    return null;
  }
  if (el.localName === 'pattern') {
    const els = chain(ctx, el);
    if ((attrOf(els, 'patternUnits') ?? 'objectBoundingBox') !== 'userSpaceOnUse')
      return 'pattern units';
    if (attrOf(els, 'patternContentUnits') === 'objectBoundingBox') return 'pattern content units';
    if (attrOf(els, 'viewBox')) return 'pattern viewBox';
    return null;
  }
  return 'paint server';
}

const len = (v: string | null, fallback: number, box?: number): number => {
  if (v === null) return fallback;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.trim().endsWith('%') ? (n / 100) * (box ?? 1) : n;
};

// The stops as one function over [0, 1]: a pair of colours interpolates, more are stitched, and a gap before the first
// stop or after the last holds its colour.
function stopFunction(stops: readonly Stop[]): string {
  const pair = (a: Rgba, b: Rgba) =>
    `<< /FunctionType 2 /Domain [0 1] /C0 [${rgbOperands(a)}] /C1 [${rgbOperands(b)}] /N 1 >>`;
  const pts: Stop[] = [...stops];
  if (pts[0]!.offset > 0) pts.unshift({ offset: 0, color: pts[0]!.color });
  if (pts[pts.length - 1]!.offset < 1) pts.push({ offset: 1, color: pts[pts.length - 1]!.color });
  if (pts.length === 2) return pair(pts[0]!.color, pts[1]!.color);
  const fns: string[] = [];
  const bounds: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    fns.push(pair(pts[i]!.color, pts[i + 1]!.color));
    if (i + 2 < pts.length) bounds.push(pts[i + 1]!.offset);
  }
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.map(num).join(' ')}] /Encode [${fns.map(() => '0 1').join(' ')}] >>`;
}

/** The paint for `id` as a PDF pattern's resource name, a solid colour when the server reduces to one, or null when
 *  it paints nothing. `bbox` is the painted element's bounding box, for bounding-box units; `drawTile` draws a
 *  pattern's children into the current stream. */
export async function paintServer(
  ctx: SvgContext,
  id: string,
  bbox: () => Box | null,
  drawTile: (pattern: Element) => Promise<void>,
): Promise<{ pattern: string } | { color: Rgba } | null> {
  const el = byId(ctx, id);
  if (!el) return null;
  const els = chain(ctx, el);
  if (el.localName === 'pattern') return tilingPattern(ctx, els, drawTile);
  const { stops } = stopsOf(els);
  if (stops.length === 0) return null;
  if (stops.length === 1) return { color: stops[0]!.color };
  const userSpace = attrOf(els, 'gradientUnits') === 'userSpaceOnUse';
  let space: Matrix = toBase(ctx);
  if (!userSpace) {
    const b = bbox();
    if (!b || b.w <= 0 || b.h <= 0) return { color: stops[stops.length - 1]!.color };
    space = multiply(space, [b.w, 0, 0, b.h, b.x, b.y]);
  }
  space = multiply(space, parseTransform(attrOf(els, 'gradientTransform')));
  let shading: string;
  if (el.localName === 'linearGradient') {
    const coords = [
      len(attrOf(els, 'x1'), 0),
      len(attrOf(els, 'y1'), 0),
      len(attrOf(els, 'x2'), 1),
      len(attrOf(els, 'y2'), 0),
    ];
    shading = `/ShadingType 2 /Coords [${coords.map(num).join(' ')}]`;
  } else {
    const cx = len(attrOf(els, 'cx'), 0.5);
    const cy = len(attrOf(els, 'cy'), 0.5);
    const r = len(attrOf(els, 'r'), 0.5);
    const fx = len(attrOf(els, 'fx'), cx);
    const fy = len(attrOf(els, 'fy'), cy);
    const fr = len(attrOf(els, 'fr'), 0);
    shading = `/ShadingType 3 /Coords [${[fx, fy, fr, cx, cy, r].map(num).join(' ')}]`;
  }
  const obj = ctx.file.put(
    ctx.file.alloc(),
    `<< /PatternType 2 /Shading << ${shading} /ColorSpace /DeviceRGB /Function ${stopFunction(stops)} /Extend [true true] >> /Matrix [${space.map(num).join(' ')}] >>`,
  );
  return { pattern: ctx.res.name('Pattern', obj) };
}

async function tilingPattern(
  ctx: SvgContext,
  els: readonly Element[],
  drawTile: (pattern: Element) => Promise<void>,
): Promise<{ pattern: string } | null> {
  const w = len(attrOf(els, 'width'), 0);
  const h = len(attrOf(els, 'height'), 0);
  if (w <= 0 || h <= 0) return null;
  const tileOrigin = multiply(
    parseTransform(attrOf(els, 'patternTransform')),
    translate(len(attrOf(els, 'x'), 0), len(attrOf(els, 'y'), 0)),
  );
  const matrix = multiply(toBase(ctx), tileOrigin);
  const holder = els.find((e) => e.childElementCount > 0) ?? els[0]!;
  // The tile is drawn in its own stream, in the pattern's space, and its text is no part of the text layer.
  const saved = { out: ctx.out, toRoot: ctx.toRoot, baseToRoot: ctx.baseToRoot, text: ctx.text };
  ctx.out = [];
  ctx.toRoot = multiply(ctx.toRoot, tileOrigin);
  ctx.baseToRoot = ctx.toRoot;
  ctx.text = null;
  try {
    await drawTile(holder);
    const obj = ctx.file.putStream(
      ctx.file.alloc(),
      `/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 ${num(w)} ${num(h)}] /XStep ${num(w)} /YStep ${num(h)} /Matrix [${matrix.map(num).join(' ')}] /Resources ${ctx.res.ref} 0 R`,
      ctx.out.join('\n'),
    );
    return { pattern: ctx.res.name('Pattern', obj) };
  } finally {
    Object.assign(ctx, saved);
  }
}
