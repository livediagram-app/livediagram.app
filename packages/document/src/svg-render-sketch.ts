// A sketched element in the SVG export (docs/specs/008-canvas/finish.md "Sketch"): the same drawing the canvas
// overlay paints (sketch-element.ts), placed at the element's position. Layers bottom to top: solid fill,
// pencil shading (the stroke colour, faint), outline, chrome.
import { finishWobblesArt, resolveFinish, type Finish } from './finish';
import type { BoxedElement, Element } from './index';
import { SHAPE_DETAIL_STROKE_PX } from './shape-geometry';
import { SKETCH_HATCH_OPACITY, sketchElementPaint, type SketchDrawing } from './sketch-element';
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
      `<path d="${drawing.hatch}" stroke="${stroke}" stroke-opacity="${SKETCH_HATCH_OPACITY}" stroke-width="${r2(Math.max(1, paint.strokePx / 2))}"${line}/>`,
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

/** The id of the hand-drawn wobble icons and stickers are drawn through under Sketch, in an export. */
export const SKETCH_ART_FILTER_ID = 'lvd-sketch-art';

/** The wobble's <defs> (the canvas's SketchFilterDefs, the same two passes) when an element on the tab draws through
 *  it, else empty. */
export function svgSketchArtDefs(elements: readonly Element[], tabFinish: unknown): string {
  const needs = elements.some(
    (el) =>
      finishWobblesArt(el as { type: string; shape?: string }) &&
      resolveFinish((el as { finish?: unknown }).finish, tabFinish) === 'sketch',
  );
  if (!needs) return '';
  return (
    `<defs><filter id="${SKETCH_ART_FILTER_ID}" x="-15%" y="-15%" width="130%" height="130%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="7" result="n1"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n1" scale="3" xChannelSelector="R" yChannelSelector="G" result="p1"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="23" result="n2"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n2" scale="3" xChannelSelector="G" yChannelSelector="R" result="p2"/>` +
    `<feMerge><feMergeNode in="p1"/><feMergeNode in="p2"/></feMerge></filter></defs>`
  );
}
