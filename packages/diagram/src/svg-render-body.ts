// Which BODY an element draws in an export, and the list of kinds that have
// one (spec/143).
//
// Two things that must agree, so they live together: the dispatch below picks
// an element's body, and `shapeHasBespokeBody` names the kinds it picks one
// for. `boxedNeedsSvgRaster` reads the second to decide what the PNG / PDF
// path has to rasterise instead of drawing with its canvas-2D drawers, so a
// kind added to one and not the other is a kind that exports as a chart in an
// SVG and a plain box in a PNG. That is the exact bug spec/143 exists to stop,
// and keeping the pair in one module is how it is stopped.

import { isCollabPanelShape } from './collab-shapes';
import {
  isBarShape,
  isLineShape,
  isPieShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
} from './data-shapes';
import { defaultPadding, PADDING_PX } from './index';
import { svgBarChart, svgLineChart, svgPieChart } from './svg-render-charts';
import {
  svgEntityRows,
  svgPageMasthead,
  svgProgressBar,
  svgProgressRing,
  svgRating,
  svgTimelineRail,
} from './svg-render-data';
import {
  BEHAVIOUR_FACE_SHAPES,
  svgBehaviourFace,
  svgCollabFace,
  svgFace,
} from './svg-render-faces';
import { svgWebComponent } from './svg-render-web';
import { isWebComponentShape } from './web-components';
import type { BoxedElement, ShapeKind } from './index';

/** The kinds whose body these emitters draw, rather than it being a box with a
 *  label. See the module comment: the PNG path reads this. */
export function shapeHasBespokeBody(kind: ShapeKind): boolean {
  return (
    isSelfDrawingShape(kind) ||
    isCollabPanelShape(kind) ||
    BEHAVIOUR_FACE_SHAPES.has(kind) ||
    isWebComponentShape(kind) ||
    kind === 'entity' ||
    kind === 'page' ||
    kind === 'lane' ||
    kind === 'browser'
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
     *  every other label on the board. */
    labelColor: string;
    fontFamily?: string;
    /** The element's resolved stroke + fill, which its body paints with. */
    stroke: string;
    fill: string;
    /** The tab theme's categorical ramp, for the charts. */
    chartPalette?: readonly string[];
    /** The element's label text, for the faces that write their own title. */
    label: string;
  },
): string {
  if (el.type !== 'shape') return '';
  const { labelColor, fontFamily, stroke, fill, chartPalette, label } = o;
  if (isPieShape(el.shape)) return svgPieChart(el, labelColor, chartPalette, fontFamily);
  if (isBarShape(el.shape)) return svgBarChart(el, labelColor, chartPalette, fontFamily);
  if (isLineShape(el.shape)) return svgLineChart(el, labelColor, chartPalette, fontFamily);
  if (el.shape === 'progress-bar') return svgProgressBar(el, stroke, fill, labelColor, fontFamily);
  if (el.shape === 'progress-ring')
    return svgProgressRing(el, stroke, fill, labelColor, fontFamily);
  if (isRatingShape(el.shape)) return svgRating(el, stroke);
  if (isRailShape(el.shape)) return svgTimelineRail(el, stroke, labelColor, fontFamily);
  if (el.shape === 'entity') return svgEntityRows(el, labelColor, fontFamily);
  // The web components (spec/146) lay out their own text, label included.
  if (isWebComponentShape(el.shape))
    return svgWebComponent(el, { stroke, fill, labelColor, label, fontFamily });
  if (el.shape === 'page')
    return svgPageMasthead(el, PADDING_PX[el.padding ?? defaultPadding(el)], fontFamily);
  // The Behaviour + Collaborate faces (spec/103 to /137), which all exported
  // as the same blank labelled box as each other.
  return svgFace(
    svgBehaviourFace(el, label, labelColor, stroke) ?? svgCollabFace(el, label, labelColor) ?? '',
    fontFamily,
  );
}
