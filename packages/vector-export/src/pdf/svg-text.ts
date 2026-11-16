// Text on a PDF page (liveworkspace/docs/specs/013-export/vector-pdf.md "Text"): the browser lays each `<text>` out in the mounted SVG; its
// glyphs are drawn as outlines in the faces the export embeds (outline-element.ts, the Logo Kit's code), and its
// characters go into the invisible text layer, line by line, where the browser put them.
import {
  outlineTextElement,
  placedChars,
  type OutlinedPath,
} from '../outline-text/outline-element';
import { placeGlyphs } from './glyph-forms';
import { apply, lengthScale, multiply, type Matrix } from './matrix';
import { parsePaint } from './svg-color';
import type { SvgContext } from './svg-context';
import { paintPath, type PaintSpec } from './svg-paint';
import { pathToPdf } from './svg-path';
import type { Box } from './svg-transform';
import type { TextItem } from './text-layer';

/** The text's runs on one baseline each, in PDF points on the page: a new run wherever a character does not start
 *  where the one before it ended (a line break, a tspan placed on its own, a turn on an arc). */
export function textItemsOf(t: SVGTextContentElement, toPage: Matrix): TextItem[] {
  const placed = placedChars(t);
  if (!placed) return [];
  const size =
    parseFloat(getComputedStyle(t).fontSize) || parseFloat(t.getAttribute('font-size') ?? '') || 16;
  const tagged = t.closest('[data-pdf-tag]');
  const tag = tagged?.getAttribute('data-pdf-tag') ?? undefined;
  const block = tagged?.getAttribute('data-pdf-block') ?? undefined;
  const scale = lengthScale(toPage);
  const items: TextItem[] = [];
  let run: { text: string; sx: number; sy: number; ex: number; ey: number; rotate: number } | null =
    null;
  const flush = () => {
    if (!run) return;
    const text = run.text.trim();
    if (text) {
      const [x0, y0] = apply(toPage, run.sx, run.sy);
      const [x1, y1] = apply(toPage, run.ex, run.ey);
      items.push({
        text,
        x0,
        y0,
        x1,
        y1,
        size: size * scale,
        ...(tag ? { tag } : {}),
        ...(block ? { block } : {}),
      });
    }
    run = null;
  };
  placed.chars.forEach((c, i) => {
    const p = placed.places[i];
    if (!p || !c.ch) return;
    const joins =
      run &&
      Math.hypot(p.x - run.ex, p.y - run.ey) <= 0.6 * size &&
      Math.abs(p.rotate - run.rotate) < 5;
    if (!joins) flush();
    if (!run) run = { text: '', sx: p.x, sy: p.y, ex: p.endX, ey: p.endY, rotate: p.rotate };
    run.text += c.ch;
    run.ex = p.endX;
    run.ey = p.endY;
  });
  flush();
  return items;
}

/** The text's outlines, or null when they can't be drawn (no embedded face, a letter outside it, a layout the
 *  browser counts differently): the text then falls back to a picture. */
export function outlinesOf(ctx: SvgContext, t: SVGTextContentElement): OutlinedPath[] | null {
  if (!ctx.outliner) return null;
  try {
    return outlineTextElement(t, ctx.outliner.faces, ctx.outliner.open);
  } catch {
    return null;
  }
}

const alpha = (v: string | undefined) => {
  const n = v === undefined ? 1 : parseFloat(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
};

/** Draws outlined paths (in the current user space, the text's) with the paint the text had. */
export async function drawOutlines(
  ctx: SvgContext,
  t: SVGTextContentElement,
  paths: readonly OutlinedPath[],
  base: PaintSpec,
  drawTile: (pattern: Element) => Promise<void>,
): Promise<void> {
  const bbox = (): Box | null => {
    try {
      const b = t.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    } catch {
      return null;
    }
  };
  for (const p of paths) {
    const spec: PaintSpec = {
      ...base,
      fill: parsePaint(p.fill),
      stroke: p.stroke ? parsePaint(p.stroke) : { kind: 'none' },
      fillAlpha: alpha(p.fillOpacity) * base.fillAlpha,
      strokeAlpha: alpha(p.strokeOpacity) * base.strokeAlpha,
      strokeWidth: p.strokeWidth ?? 1,
      join: p.miterJoin ? 'miter' : base.join,
      miter: p.miterJoin ? 4 : base.miter,
      dash: [],
      evenOdd: false,
    };
    // Plain filled letters are placed glyph by glyph, each glyph written once; anything else is drawn as its path.
    const glyphs =
      p.glyphs && spec.stroke.kind === 'none' && spec.fill.kind === 'color' ? p.glyphs : null;
    if (glyphs) {
      await paintPath(ctx, 'glyphs', spec, bbox, drawTile, () =>
        placeGlyphs(ctx, glyphs.face, glyphs.placed),
      );
    } else await paintPath(ctx, pathToPdf(p.d), spec, bbox, drawTile);
  }
}

/** Adds the text's characters to the text layer, from the current user space (the text's). */
export function addTextItems(ctx: SvgContext, t: SVGTextContentElement, toRoot: Matrix): void {
  if (!ctx.text) return;
  ctx.text.push(...textItemsOf(t, multiply(ctx.rootToPage, toRoot)));
}
