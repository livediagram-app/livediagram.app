// How a page is drawn (liveworkspace/docs/specs/013-export/vector-pdf.md "How a page is drawn"): the mounted SVG is walked in document order,
// each element written as PDF operators inside its own saved graphics state: its transform, its clip, a translucent
// group as a transparency group, then its shapes, pictures, text and children. An element with no PDF form is drawn
// as a picture of itself (svg-raster.ts), the rest of the page staying vector. On a tagged page an element with alt
// text (`data-pdf-alt`) is drawn as a Figure, everything else as an artifact ("Tags").
import { invert, isIdentity, mapRect, matrixOps, multiply, num, type Matrix } from './matrix';
import { byId, type SvgContext } from './svg-context';
import { drawImage } from './svg-image';
import { paintPath, paintSpecOf } from './svg-paint';
import { paintServerProblem } from './svg-paint-server';
import { segmentsToPdf, type Segment } from './svg-path';
import { rasterElement } from './svg-raster';
import { segmentBounds, shapeSegments, transformSegments } from './svg-shapes';
import { knockoutClip } from './svg-mask';
import { refId, styleOf } from './svg-style';
import { addTextItems, drawOutlines, outlinesOf } from './svg-text';
import { parseTransform, parseViewBox, viewBoxMatrix, type Box } from './svg-transform';

// Drawn by reference only, never where they stand.
const NOT_RENDERED = new Set([
  'defs',
  'style',
  'script',
  'title',
  'desc',
  'metadata',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'filter',
  'marker',
  'symbol',
]);
const CONTAINERS = new Set(['g', 'a', 'svg', 'switch']);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
// CSS blend modes PDF has under the same meaning (ISO 32000-1 §11.3.5).
const BLENDS: Record<string, string> = {
  normal: 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'ColorDodge',
  'color-burn': 'ColorBurn',
  'hard-light': 'HardLight',
  'soft-light': 'SoftLight',
  difference: 'Difference',
  exclusion: 'Exclusion',
  hue: 'Hue',
  saturation: 'Saturation',
  color: 'Color',
  luminosity: 'Luminosity',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function transformOf(el: Element): Matrix {
  return parseTransform(el.getAttribute('transform'));
}

// A nested <svg>'s placement: its x and y, its viewBox fitted to its size; and the viewport it clips to.
function viewportOf(el: Element): { matrix: Matrix; clip: Box | null } {
  const n = (name: string, d: number) => {
    const v = parseFloat(el.getAttribute(name) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  const port = { x: n('x', 0), y: n('y', 0), w: n('width', 0), h: n('height', 0) };
  const vb = parseViewBox(el.getAttribute('viewBox'));
  const matrix = vb
    ? viewBoxMatrix(vb, port, el.getAttribute('preserveAspectRatio'))
    : ([1, 0, 0, 1, port.x, port.y] as Matrix);
  const hidden = styleOf(el)('overflow') !== 'visible';
  return { matrix, clip: hidden && port.w > 0 && port.h > 0 ? port : null };
}

function bboxOf(el: Element, segs?: readonly Segment[] | null): Box | null {
  try {
    const b = (el as SVGGraphicsElement).getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    return segs ? segmentBounds(segs) : null;
  }
}

/** The clip a `clip-path` names, as one path in the element's user space with its rule; null when PDF can't clip by
 *  it (text or another clip inside it). An empty clip hides the element. */
function clipPathOf(
  ctx: SvgContext,
  el: Element,
  id: string,
): { ops: string; evenOdd: boolean } | null {
  const clip = byId(ctx, id);
  if (!clip || clip.localName !== 'clipPath') return null;
  if (refId(styleOf(clip)('clip-path') || 'none')) return null;
  let space = transformOf(clip);
  if (clip.getAttribute('clipPathUnits') === 'objectBoundingBox') {
    const b = bboxOf(el, shapeSegments(el));
    if (!b) return null;
    space = multiply([b.w, 0, 0, b.h, b.x, b.y], space);
  }
  const segs: Segment[] = [];
  let evenOdd = false;
  for (const child of clip.children) {
    if (styleOf(child)('display') === 'none') continue;
    const own = shapeSegments(child);
    if (own === null) {
      if (NOT_RENDERED.has(child.localName)) continue;
      return null;
    }
    if (refId(styleOf(child)('clip-path'))) return null;
    if (styleOf(child)('clip-rule') === 'evenodd') evenOdd = true;
    segs.push(...transformSegments(own, multiply(space, transformOf(child))));
  }
  return { ops: segs.length ? segmentsToPdf(segs) : '0 0 m h', evenOdd };
}

/** Why `el` must be drawn as a picture, or null when it can be drawn as vectors. */
export function fallbackReason(ctx: SvgContext, el: Element): string | null {
  const style = styleOf(el);
  if (style('filter') !== 'none') return 'filter';
  const mask = refId(style('mask'));
  if (style('mask') !== 'none' && !(mask && knockoutClip(ctx, mask))) return 'mask';
  if (el.localName === 'foreignObject' || el.localName === 'use') return el.localName;
  if (!(style('mix-blend-mode') in BLENDS)) return 'blend';
  const clip = refId(style('clip-path'));
  if (clip && !clipPathOf(ctx, el, clip)) return 'clip';
  if (SHAPES.has(el.localName)) {
    for (const m of ['marker-start', 'marker-mid', 'marker-end']) {
      const v = el.getAttribute(m) ?? getComputedStyle(el).getPropertyValue(m);
      if (v && v !== 'none') return 'marker';
    }
  }
  if (SHAPES.has(el.localName) || el.localName === 'text') {
    const fill = refId(style('fill'));
    if (fill && paintServerProblem(ctx, fill)) return 'paint';
    const stroke = refId(style('stroke'));
    if (stroke && paintServerProblem(ctx, stroke)) return 'paint';
  }
  return null;
}

/** Collects the text layer's characters inside an element drawn as a picture: its text still reads. */
function textInside(ctx: SvgContext, el: Element, toRoot: Matrix): void {
  if (el.localName === 'text') {
    addTextItems(ctx, el as SVGTextContentElement, toRoot);
    return;
  }
  for (const child of el.children) {
    if (NOT_RENDERED.has(child.localName)) continue;
    const m = child.localName === 'svg' ? viewportOf(child).matrix : transformOf(child);
    textInside(ctx, child, multiply(toRoot, m));
  }
}

async function drawChildren(ctx: SvgContext, el: Element): Promise<void> {
  for (const child of el.children) await drawElement(ctx, child);
}

const altOf = (el: Element) => el.getAttribute('data-pdf-alt')?.trim() ?? '';
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** The top edge of `el` (in the current user space, then `local`) in PDF points, y up; -Infinity with no box. */
function topOf(ctx: SvgContext, el: Element, local: Matrix): number {
  const b = bboxOf(el);
  if (!b) return -Infinity;
  const r = mapRect(multiply(ctx.rootToPage, multiply(ctx.toRoot, local)), b);
  return r.y + r.h;
}

/** Draws as a Figure of `alts` on a tagged page, the page's artifact closed around it; inside a figure or a group,
 *  its alt texts join that one's. */
async function asFigure(
  ctx: SvgContext,
  alts: string[],
  top: () => number,
  draw: () => Promise<void>,
): Promise<void> {
  const tags = ctx.tags;
  if (!tags) {
    ctx.alts?.push(...alts);
    return draw();
  }
  const fig = tags.figure(alts, top());
  const outer = ctx.alts;
  ctx.out.push('EMC', fig.open);
  ctx.tags = null;
  ctx.alts = alts;
  try {
    await draw();
  } finally {
    ctx.tags = tags;
    ctx.alts = outer;
    ctx.out.push(fig.close, '/Artifact BMC');
  }
}

/** Writes `el` and everything in it. */
export async function drawElement(ctx: SvgContext, el: Element): Promise<void> {
  const alt = ctx.tags || ctx.alts ? altOf(el) : '';
  if (!alt || styleOf(el)('display') === 'none') return drawBody(ctx, el);
  return asFigure(
    ctx,
    [alt],
    () => topOf(ctx, el, transformOf(el)),
    () => drawBody(ctx, el),
  );
}

async function drawBody(ctx: SvgContext, el: Element): Promise<void> {
  if (el.namespaceURI !== SVG_NS || NOT_RENDERED.has(el.localName)) return;
  const style = styleOf(el);
  if (style('display') === 'none') return;
  const name = el.localName;
  const known = CONTAINERS.has(name) || SHAPES.has(name) || name === 'text' || name === 'image';
  if (!known && name !== 'foreignObject' && name !== 'use') return;
  const reason = fallbackReason(ctx, el);
  const text = name === 'text' ? (el as SVGTextContentElement) : null;
  const outlines = text && !reason ? outlinesOf(ctx, text) : null;
  if (reason || (text && !outlines)) {
    const picture = async () => {
      if (style('visibility') !== 'hidden' || CONTAINERS.has(name)) await rasterElement(ctx, el);
      textInside(ctx, el, multiply(ctx.toRoot, transformOf(el)));
    };
    // The described pictures it draws: their words are the picture's.
    const inner =
      ctx.tags || ctx.alts
        ? [...el.querySelectorAll('[data-pdf-alt]')].map(altOf).filter(Boolean)
        : [];
    if (inner.length) await asFigure(ctx, inner, () => topOf(ctx, el, transformOf(el)), picture);
    else await picture();
    return;
  }
  const o = parseFloat(style('opacity'));
  const opacity = Number.isFinite(o) ? Math.min(1, Math.max(0, o)) : 1;
  if (opacity <= 0) return;
  const blend = BLENDS[style('mix-blend-mode')]!;
  let local = transformOf(el);
  let viewportClip: Box | null = null;
  if (name === 'svg' && el !== ctx.root) {
    const vp = viewportOf(el);
    local = multiply(local, vp.matrix);
    viewportClip = vp.clip ? mapRect(invert(vp.matrix) ?? vp.matrix, vp.clip) : null;
  }
  const saved = {
    toRoot: ctx.toRoot,
    out: ctx.out,
    baseToRoot: ctx.baseToRoot,
    tags: ctx.tags,
    alts: ctx.alts,
  };
  ctx.out.push('q');
  if (!isIdentity(local)) ctx.out.push(matrixOps(local));
  ctx.toRoot = multiply(ctx.toRoot, local);
  const clipId = refId(style('clip-path'));
  if (clipId) {
    // The clip is in the element's user space, before a nested svg's viewBox: drawn in that space.
    const clip = clipPathOf(ctx, el, clipId)!;
    ctx.out.push(clip.ops, clip.evenOdd ? 'W* n' : 'W n');
  }
  const maskId = refId(style('mask'));
  if (maskId) {
    // Only a knockout reaches here (fallbackReason): its clip, in the element's user space.
    ctx.out.push(knockoutClip(ctx, maskId)!.ops, 'W* n');
  }
  if (viewportClip) {
    const { x, y, w, h } = viewportClip;
    ctx.out.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re W n`);
  }
  const container = CONTAINERS.has(name);
  // A translucent group (or a shape both filled and stroked) is drawn whole, then made translucent, as SVG does.
  const spec = container ? null : paintSpecOf(el, 1, 'Normal');
  const both = !!spec && spec.fill.kind !== 'none' && spec.stroke.kind !== 'none';
  const group = (opacity < 1 && (container || both || !!text)) || (container && blend !== 'Normal');
  const drawTile = (pattern: Element) => drawChildren(ctx, pattern);
  try {
    // A group drawn on a tagged page gathers the alt texts inside it: its form is one Figure of them.
    const groupAlts: string[] = [];
    if (group) {
      ctx.out = [];
      ctx.baseToRoot = ctx.toRoot;
      if (saved.tags) {
        ctx.tags = null;
        ctx.alts = groupAlts;
      }
    }
    const leafAlpha = group ? 1 : opacity;
    const leafBlend = group ? 'Normal' : blend;
    if (container) await drawChildren(ctx, el);
    else if (SHAPES.has(name)) {
      const segs = shapeSegments(el)!;
      await paintPath(
        ctx,
        segmentsToPdf(segs),
        paintSpecOf(el, leafAlpha, leafBlend),
        () => bboxOf(el, segs),
        drawTile,
      );
    } else if (text) {
      if (style('visibility') !== 'hidden') {
        addTextItems(ctx, text, ctx.toRoot);
        await drawOutlines(ctx, text, outlines!, paintSpecOf(el, leafAlpha, leafBlend), drawTile);
      }
    } else if (name === 'image' && style('visibility') !== 'hidden')
      await drawImage(ctx, el, leafAlpha);
    if (group) {
      const inner = ctx.out;
      ctx.out = saved.out;
      // Big enough for anything on the page, in the group's own space.
      const back = invert(ctx.toRoot);
      const b = back ? mapRect(back, ctx.view) : { x: -1e5, y: -1e5, w: 2e5, h: 2e5 };
      const form = ctx.file.putStream(
        ctx.file.alloc(),
        `/Type /XObject /Subtype /Form /BBox [${[b.x, b.y, b.x + b.w, b.y + b.h].map(num).join(' ')}] /Group << /S /Transparency /I true /K false >> /Resources ${ctx.res.ref} 0 R`,
        inner.join('\n'),
      );
      const ops = [
        `/${ctx.res.state(opacity, opacity, blend)} gs`,
        `/${ctx.res.name('XObject', form)} Do`,
      ];
      if (saved.tags && groupAlts.length) {
        const fig = saved.tags.figure(groupAlts, topOf(ctx, el, IDENTITY));
        ctx.out.push('EMC', fig.open, ...ops, fig.close, '/Artifact BMC');
      } else ctx.out.push(...ops);
    }
  } finally {
    ctx.out = saved.out;
    ctx.out.push('Q');
    ctx.toRoot = saved.toRoot;
    ctx.baseToRoot = saved.baseToRoot;
    ctx.tags = saved.tags;
    ctx.alts = saved.alts;
  }
}
