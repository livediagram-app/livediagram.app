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

import {
  isBarShape,
  isLineShape,
  isPieShape,
  isRatingShape,
  isSelfDrawingShape,
} from './data-shapes';
import { defaultPadding, PADDING_PX } from './index';
import { svgBarChart, svgLineChart, svgPieChart } from './svg-render-charts';
import { svgProgressBar, svgProgressRing, svgRating } from './svg-render-data';
import { svgPageMasthead } from './svg-render-page';
import { progressTrackColour } from './progress-colours';
import { BEHAVIOUR_FACE_SHAPES, svgBehaviourFace, svgFace } from './svg-render-faces';
import { SHAPE_KINDS } from './shape-kinds';
import { svgWebComponent } from './svg-render-web';
import { isWebComponentShape } from './web-components';
import { isChipShape } from './chip';
import { svgChip } from './svg-render-chip';
import { svgBoundary } from './svg-render-boundary';
import { svgTimeline } from './svg-render-timeline';
import type { TagColour } from './tag-colours';
import type { Finish } from './finish';
import { svgPointerNote } from './svg-render-pointer-note';
import { svgDiagramKey } from './svg-render-diagram-key';
import { isConceptShape } from './concept';
import type { BoxedElement, ShapeKind } from './index';
import { defaultTextColor, type CanvasSurface } from './colors';
import type { ResolveEmojiArt, ResolveIconArt } from './svg-render-describe';

/** The kinds whose body these emitters draw, rather than it being a box with a
 *  label. See the module comment: the PNG path reads this. */
export function shapeHasBespokeBody(kind: ShapeKind): boolean {
  return (
    isSelfDrawingShape(kind) ||
    BEHAVIOUR_FACE_SHAPES.has(kind) ||
    // A retired element's placeholder (svg-render-retired.ts), which the canvas drawers know nothing of.
    !SHAPE_KINDS.has(kind) ||
    isWebComponentShape(kind) ||
    isChipShape(kind) ||
    kind === 'boundary' ||
    kind === 'pointer-note' ||
    kind === 'diagram-key' ||
    isConceptShape(kind) ||
    kind === 'page' ||
    kind === 'lane'
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
    /** The tab theme's categorical ramp, for the charts. */
    chartPalette?: readonly string[];
    /** The element's label text, for the faces that write their own title. */
    label: string;
    /** The paper under the element, for the faces whose base follows it. */
    surface?: CanvasSurface;
    /** Resolves an icon id to its art, for a card's media glyph. */
    resolveIconArt?: ResolveIconArt;
    /** Resolves an emoji to its art. No livehuddle face writes one since the Reaction Pad left; kept so the shared
     *  preview resolvers (@liveworkspace/icons/resolve) still fit. */
    resolveEmojiArt?: ResolveEmojiArt;
    // The tab's tag colours (docs/specs/009-elements/tag-colours.md), for a card's tinted tag chips.
    tagColours?: readonly TagColour[];
    /** The finish the element is drawn in (docs/specs/008-canvas/finish.md), for the faces that draw their own lines. */
    finish?: Finish;
  },
): string {
  if (el.type !== 'shape') return '';
  const { labelColor, fontFamily, stroke, fill, chartPalette, label } = o;
  if (isPieShape(el.shape)) return svgPieChart(el, labelColor, chartPalette, fontFamily);
  if (isBarShape(el.shape)) return svgBarChart(el, labelColor, chartPalette, fontFamily);
  if (isLineShape(el.shape)) return svgLineChart(el, labelColor, chartPalette, fontFamily);
  // The empty track is the element's OWN fill, else the paper's default track,
  // the one the canvas's ProgressView draws (docs/specs/009-elements/progress.md).
  const track = progressTrackColour(el, o.surface);
  if (el.shape === 'progress-bar') return svgProgressBar(el, stroke, track, labelColor, fontFamily);
  if (el.shape === 'progress-ring')
    return svgProgressRing(el, stroke, track, labelColor, fontFamily);
  if (isRatingShape(el.shape)) return svgRating(el, stroke);
  // A Timeline's milestones (docs/specs/009-elements/timeline.md).
  if (isConceptShape(el.shape)) {
    const rows = el.conceptRows ?? [];
    return rows.length > 0 ? svgTimeline(el, rows, { stroke, fill, labelColor, fontFamily }) : '';
  }
  // A pointer note's leader and tip (docs/specs/009-elements/pointer-note.md); its box and label are the usual.
  if (el.shape === 'pointer-note') return svgPointerNote(el, { stroke });
  // A diagram key's title and rows (docs/specs/009-elements/diagram-key.md); its box is the usual.
  if (el.shape === 'diagram-key')
    return svgDiagramKey(el, { stroke, fill, labelColor, label, fontFamily });
  // A boundary's tint and title (docs/specs/009-elements/boundary.md).
  if (el.shape === 'boundary')
    return svgBoundary(el, {
      stroke,
      labelColor,
      label,
      fontFamily,
      resolveIconArt: o.resolveIconArt,
    });
  // A badge or step number's pill or disc (docs/specs/009-elements/badge.md); its label draws over it as usual.
  if (isChipShape(el.shape))
    return svgChip(el, { stroke, fill, ink: el.textColor ?? defaultTextColor(el, o.surface) });
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md) lay out their own text, label included.
  if (isWebComponentShape(el.shape))
    return svgWebComponent(el, {
      stroke,
      fill,
      labelColor,
      label,
      fontFamily,
      resolveIconArt: o.resolveIconArt,
      tagColours: o.tagColours,
    });
  if (el.shape === 'page')
    return svgPageMasthead(el, PADDING_PX[el.padding ?? defaultPadding(el)], fontFamily);
  // The Behaviour faces (docs/specs/009-elements/mode-button.md to /137), which all exported as the same blank
  // labelled box as each other.
  return svgFace(
    svgBehaviourFace(el, label, labelColor, stroke, o.fill, o.surface) ?? '',
    fontFamily,
  );
}
