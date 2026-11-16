// Filling and stroking a path (liveworkspace/docs/specs/013-export/vector-pdf.md "Paint"): colours, gradients and patterns, their opacities as a
// shared graphics state, the stroke's width, caps, joins, miter limit and dashes, the fill rule and the paint order.
import { num } from './matrix';
import { parsePaint, rgbOperands, type Paint } from './svg-color';
import type { SvgContext } from './svg-context';
import { paintServer } from './svg-paint-server';
import { lengthOf, styleOf } from './svg-style';
import type { Box } from './svg-transform';

export type PaintSpec = {
  fill: Paint;
  stroke: Paint;
  fillAlpha: number;
  strokeAlpha: number;
  strokeWidth: number;
  cap: string;
  join: string;
  miter: number;
  dash: number[];
  dashOffset: number;
  evenOdd: boolean;
  strokeFirst: boolean;
  blend: string;
};

const CAPS: Record<string, number> = { butt: 0, round: 1, square: 2 };
const JOINS: Record<string, number> = { miter: 0, 'miter-clip': 0, arcs: 0, round: 1, bevel: 2 };

/** A computed dash array as lengths: an odd list repeated, none when any is negative or all are zero. */
export function dashOf(value: string): number[] {
  if (!value || value === 'none') return [];
  const parts = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((p) => parseFloat(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0) || parts.every((n) => n === 0)) return [];
  return parts.length % 2 ? [...parts, ...parts] : parts;
}

const unit = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
};

/** The paint `el` is drawn with, its own opacity folded into both alphas. */
export function paintSpecOf(el: Element, opacity: number, blend: string): PaintSpec {
  const style = styleOf(el);
  const strokeWidth = lengthOf(style('stroke-width'), 1);
  return {
    fill: parsePaint(style('fill')),
    stroke: strokeWidth > 0 ? parsePaint(style('stroke')) : { kind: 'none' },
    fillAlpha: unit(style('fill-opacity')) * opacity,
    strokeAlpha: unit(style('stroke-opacity')) * opacity,
    strokeWidth,
    cap: style('stroke-linecap'),
    join: style('stroke-linejoin'),
    miter: lengthOf(style('stroke-miterlimit'), 4),
    dash: dashOf(style('stroke-dasharray')),
    dashOffset: lengthOf(style('stroke-dashoffset'), 0),
    evenOdd: style('fill-rule') === 'evenodd',
    strokeFirst: style('paint-order').trim().startsWith('stroke'),
    blend,
  };
}

// The colour operators for one paint, `stroking` for the stroke's (upper-case) set; null when it paints nothing.
async function setPaint(
  ctx: SvgContext,
  paint: Paint,
  stroking: boolean,
  bbox: () => Box | null,
  drawTile: (pattern: Element) => Promise<void>,
): Promise<{ ops: string; alpha: number } | null> {
  const color = (c: { r: number; g: number; b: number; a: number }) => ({
    ops: `${rgbOperands(c)} ${stroking ? 'RG' : 'rg'}`,
    alpha: c.a,
  });
  if (paint.kind === 'none') return null;
  if (paint.kind === 'color') return color(paint.color);
  const server = await paintServer(ctx, paint.id, bbox, drawTile);
  if (!server) return paint.fallback ? color(paint.fallback) : null;
  if ('color' in server) return color(server.color);
  return {
    ops: `/Pattern ${stroking ? 'CS' : 'cs'} /${server.pattern} ${stroking ? 'SCN' : 'scn'}`,
    alpha: 1,
  };
}

/** Writes `path` (PDF path operators) filled and stroked as `spec` says. */
export async function paintPath(
  ctx: SvgContext,
  path: string,
  spec: PaintSpec,
  bbox: () => Box | null,
  drawTile: (pattern: Element) => Promise<void>,
  // Operators filling the shape with the colour set (placed glyph forms), in place of `path f`: only for a shape
  // filled, not stroked, with a plain colour (a pattern inside a form would take the form's space).
  filled?: () => string,
): Promise<void> {
  if (!path) return;
  const fill = await setPaint(ctx, spec.fill, false, bbox, drawTile);
  const stroke = await setPaint(ctx, spec.stroke, true, bbox, drawTile);
  if (!fill && !stroke) return;
  const fa = fill ? fill.alpha * spec.fillAlpha : 1;
  const sa = stroke ? stroke.alpha * spec.strokeAlpha : 1;
  if ((!fill || fa <= 0) && (!stroke || sa <= 0)) return;
  const out = ctx.out;
  out.push('q');
  if (fa < 1 || sa < 1 || spec.blend !== 'Normal')
    out.push(`/${ctx.res.state(fa, sa, spec.blend)} gs`);
  if (fill) out.push(fill.ops);
  if (stroke) {
    out.push(stroke.ops, `${num(spec.strokeWidth)} w`);
    out.push(
      `${CAPS[spec.cap] ?? 0} J ${JOINS[spec.join] ?? 0} j ${num(Math.max(1, spec.miter))} M`,
    );
    if (spec.dash.length) out.push(`[${spec.dash.map(num).join(' ')}] ${num(spec.dashOffset)} d`);
  }
  const star = spec.evenOdd ? '*' : '';
  if (fill && stroke && !spec.strokeFirst) out.push(path, `B${star}`);
  else if (fill && stroke) out.push(path, 'S', path, `f${star}`);
  else if (fill && filled) out.push(filled());
  else if (fill) out.push(path, `f${star}`);
  else out.push(path, 'S');
  out.push('Q');
}
