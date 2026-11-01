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
import { svgSankey } from './svg-render-sankey';
import { isSankeyShape } from './sankey-model';
import { svgProgressBar, svgProgressRing, svgRating } from './svg-render-data';
import { svgPageMasthead } from './svg-render-page';
import { progressTrackColour } from './progress-colours';
import { svgWebComponent } from './svg-render-web';
import { isWebComponentShape } from './web-components';
import { isChipShape } from './chip';
import { svgChip } from './svg-render-chip';
import { svgConcept } from './svg-render-concept';
import type { TagColour } from './tag-colours';
import { svgPointerNote } from './svg-render-pointer-note';
import { isConceptShape } from './concept';
import type { BoxedElement, ShapeKind } from './index';
import { defaultTextColor, type CanvasSurface } from './colors';
import type { ResolveIconArt } from './svg-render-describe';

/** The kinds whose body these emitters draw, rather than it being a box with a
 *  label. See the module comment: the PNG path reads this. */
export function shapeHasBespokeBody(kind: ShapeKind): boolean {
  return (
    isSelfDrawingShape(kind) ||
    isWebComponentShape(kind) ||
    isChipShape(kind) ||
    kind === 'pointer-note' ||
    isConceptShape(kind) ||
    kind === 'page' ||
    kind === 'browser' ||
    kind === 'tab-window' ||
    kind === 'instance'
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
    /** What a chart sits on, where a page's fill makes it matter (chartPageGrounds). */
    chartGround?: readonly string[];
    /** The element's label text, for the faces that write their own title. */
    label: string;
    /** The paper under the element, for the faces whose base follows it. */
    surface?: CanvasSurface;
    /** Resolves an icon id to its art, for a card's media glyph. */
    resolveIconArt?: ResolveIconArt;
    // The tab's tag colours (docs/specs/009-elements/tag-colours.md), for a card's tinted tag chips.
    tagColours?: readonly TagColour[];
  },
): string {
  if (el.type !== 'shape') return '';
  const { labelColor, fontFamily, stroke, fill, chartPalette, chartGround, label } = o;
  if (isPieShape(el.shape))
    return svgPieChart(el, labelColor, chartPalette, fontFamily, chartGround);
  if (isBarShape(el.shape))
    return svgBarChart(el, labelColor, chartPalette, fontFamily, chartGround);
  if (isLineShape(el.shape))
    return svgLineChart(el, labelColor, chartPalette, fontFamily, chartGround);
  if (isSankeyShape(el.shape))
    return svgSankey(el, labelColor, chartPalette, fontFamily, chartGround);
  // The empty track is the element's OWN fill, else the paper's default track,
  // the one the canvas's ProgressView draws (docs/specs/009-elements/progress.md).
  const track = progressTrackColour(el, o.surface);
  if (el.shape === 'progress-bar') return svgProgressBar(el, stroke, track, labelColor, fontFamily);
  if (el.shape === 'progress-ring')
    return svgProgressRing(el, stroke, track, labelColor, fontFamily);
  if (isRatingShape(el.shape)) return svgRating(el, stroke);
  // A layer stack, pyramid or cycle's rows (docs/specs/009-elements/concept-graphics.md).
  if (isConceptShape(el.shape))
    return svgConcept(el, { stroke, fill, labelColor, label, fontFamily });
  // A pointer note's leader and tip (docs/specs/009-elements/pointer-note.md); its box and label are the usual.
  if (el.shape === 'pointer-note') return svgPointerNote(el, { stroke });
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
  return '';
}
