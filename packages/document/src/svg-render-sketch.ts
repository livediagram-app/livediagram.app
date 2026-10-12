// A sketched element in the SVG export (docs/specs/008-canvas/finish.md "Sketch"): the same drawing the canvas
// overlay paints (sketch-element.ts), placed at the element's position. Layers bottom to top: solid fill,
// hatching, outline, chrome.
import type { Finish } from './finish';
import type { BoxedElement } from './index';
import { SHAPE_DETAIL_STROKE_PX } from './shape-geometry';
import { sketchElementPaint, type SketchDrawing } from './sketch-element';
import type { ExportShape } from './svg-render-describe';
import { r2, xmlEscape } from './svg-render-primitives';

export function svgSketchDrawing(
  at: { x: number; y: number },
  drawing: SketchDrawing,
  paint: { fill: string; stroke: string; strokePx: number; dash: string | null },
): string {
  const fill = xmlEscape(paint.fill);
  const stroke = xmlEscape(paint.stroke);
  const dash = paint.dash ? ` stroke-dasharray="${paint.dash}"` : '';
  const line = ' fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const parts = [`<g transform="translate(${r2(at.x)} ${r2(at.y)})" data-finish="sketch">`];
  if (drawing.solid) parts.push(`<path d="${drawing.solid}" fill="${fill}"/>`);
  if (drawing.hatch)
    parts.push(
      `<path d="${drawing.hatch}" stroke="${fill}" stroke-width="${r2(Math.max(1, paint.strokePx / 2))}"${line}/>`,
    );
  if (drawing.strokes)
    parts.push(
      `<path d="${drawing.strokes}" stroke="${stroke}" stroke-width="${r2(paint.strokePx)}"${dash}${line}/>`,
    );
  if (drawing.details)
    parts.push(
      `<path d="${drawing.details}" stroke="${stroke}" stroke-width="${SHAPE_DETAIL_STROKE_PX}"${line}/>`,
    );
  parts.push('</g>');
  return parts.join('');
}

/** A boxed element's sketched body for the export, or null when it is not sketched (another finish, or a
 *  kind Sketch leaves as drawn). */
export function svgSketchedBody(
  el: BoxedElement,
  shape: ExportShape,
  finish: Finish,
  // Something sits on this shape (sketch-backdrop.ts): a solid fill, never hatching.
  backdrop = false,
): string | null {
  if (shape.kind !== 'rect' && shape.kind !== 'ellipse' && shape.kind !== 'diamond') return null;
  const paint = sketchElementPaint(el, finish, shape.fill, backdrop);
  if (!paint) return null;
  return svgSketchDrawing({ x: el.x, y: el.y }, paint.drawing, {
    fill: shape.fill,
    stroke: shape.stroke,
    strokePx: paint.strokePx,
    dash: paint.dash,
  });
}
