// Which BODY an element draws in an export, and the list of kinds that have
// one (docs/specs/020-import-export/export-fidelity.md).
//
// Two things that must agree, so they live together: the dispatch below picks
// an element's body, and `shapeHasBespokeBody` names the kinds it picks one
// for. `boxedNeedsSvgRaster` reads the second to decide what the PNG / PDF
// path has to rasterise instead of drawing with its canvas-2D drawers, so a
// kind added to one and not the other is a kind that exports as a chart in an
// SVG and a plain box in a PNG. That is the exact bug docs/specs/020-import-export/export-fidelity.md exists to stop,
// and keeping the pair in one module is how it is stopped.

import { isSelfDrawingShape } from './data-shapes';
import { BEHAVIOUR_FACE_SHAPES, svgBehaviourFace, svgFace } from './svg-render-faces';
import { SHAPE_KINDS } from './shape-kinds';
import type { Finish } from './finish';
import type { BoxedElement, ShapeKind } from './index';
import type { CanvasSurface } from './colors';
import type { ResolveEmojiArt, ResolveIconArt } from './svg-render-describe';

/** The kinds whose body these emitters draw, rather than it being a box with a
 *  label. See the module comment: the PNG path reads this. */
export function shapeHasBespokeBody(kind: ShapeKind): boolean {
  return (
    isSelfDrawingShape(kind) ||
    BEHAVIOUR_FACE_SHAPES.has(kind) ||
    // A retired element's placeholder (svg-render-retired.ts), which the canvas drawers know nothing of.
    !SHAPE_KINDS.has(kind)
  );
}

/**
 * What an element draws INSTEAD of (or under) a plain label: its plot, its
 * value, its rows, its face. Empty string when the kind has none, which is
 * what tells the caller to keep drawing the box.
 */
export function svgElementBody(
  el: BoxedElement,
  o: {
    /** The label's resolved colour + face, so a body's own text reads like
     *  every other label on the canvas. */
    labelColor: string;
    fontFamily?: string;
    /** The element's resolved stroke + fill, which its body paints with. */
    stroke: string;
    fill: string;
    /** The element's label text, for the faces that write their own title. */
    label: string;
    /** The paper under the element, for the faces whose base follows it. */
    surface?: CanvasSurface;
    /** Resolves an icon id to its art. No livehuddle body draws one since the card left; kept so the shared preview
     *  resolvers (@liveworkspace/icons/resolve) still fit. */
    resolveIconArt?: ResolveIconArt;
    /** Resolves an emoji to its art. No livehuddle face writes one since the Reaction Pad left; kept so the shared
     *  preview resolvers (@liveworkspace/icons/resolve) still fit. */
    resolveEmojiArt?: ResolveEmojiArt;
    /** The finish the element is drawn in (docs/specs/008-canvas/finish.md), for the faces that draw their own lines. */
    finish?: Finish;
  },
): string {
  if (el.type !== 'shape') return '';
  const { labelColor, fontFamily, stroke, label } = o;
  // The Behaviour faces (docs/specs/009-elements/mode-button.md to /137), which all exported as the same blank
  // labelled box as each other.
  return svgFace(
    svgBehaviourFace(el, label, labelColor, stroke, o.fill, o.surface) ?? '',
    fontFamily,
  );
}
