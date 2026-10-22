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

import { isCollabPanelShape } from './collab-shapes';
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
import { svgEntityRows } from './svg-render-entity';
import { svgPageMasthead } from './svg-render-page';
import { progressTrackColour } from './progress-colours';
import { BEHAVIOUR_FACE_SHAPES, svgBehaviourFace, svgFace } from './svg-render-faces';
import { svgCollabFace } from './svg-render-collab-faces';
import { svgWebComponent } from './svg-render-web';
import { isWebComponentShape } from './web-components';
import { isChipShape } from './chip';
import { svgChip } from './svg-render-chip';
import { svgBoundary } from './svg-render-boundary';
import { svgConcept } from './svg-render-concept';
import type { TagColour } from './tag-colours';
import type { Finish } from './finish';
import { svgPointerNote } from './svg-render-pointer-note';
import { svgPersonNode } from './svg-render-person-node';
import { isPersonNode } from './person-node';
import { svgDiagramKey } from './svg-render-diagram-key';
import { svgSequencePicture } from './svg-render-sequence';
import { isConceptShape } from './concept';
import type { BoxedElement, ShapeKind } from './index';
import { defaultTextColor, type CanvasSurface } from './colors';
import type { ResolveEmojiArt, ResolveIconArt } from './svg-render-describe';

/** The kinds whose body these emitters draw, rather than it being a box with a
 *  label. See the module comment: the PNG path reads this. */
export function shapeHasBespokeBody(kind: ShapeKind): boolean {
  return (
    isSelfDrawingShape(kind) ||
    isCollabPanelShape(kind) ||
    BEHAVIOUR_FACE_SHAPES.has(kind) ||
    isWebComponentShape(kind) ||
    isChipShape(kind) ||
    kind === 'boundary' ||
    kind === 'pointer-note' ||
    kind === 'diagram-key' ||
    kind === 'sequence' ||
    isConceptShape(kind) ||
    kind === 'entity' ||
    kind === 'page' ||
    kind === 'lane' ||
    kind === 'browser' ||
    kind === 'tab-window'
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
    /** Resolves an emoji to its art, for a face that writes one (a reaction pad). */
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
  if (isSankeyShape(el.shape)) return svgSankey(el, labelColor, chartPalette, fontFamily);
  // The empty track is the element's OWN fill, else the paper's default track,
  // the one the canvas's ProgressView draws (docs/specs/009-elements/progress.md).
  const track = progressTrackColour(el, o.surface);
  if (el.shape === 'progress-bar') return svgProgressBar(el, stroke, track, labelColor, fontFamily);
  if (el.shape === 'progress-ring')
    return svgProgressRing(el, stroke, track, labelColor, fontFamily);
  if (isRatingShape(el.shape)) return svgRating(el, stroke);
  if (el.shape === 'entity')
    return svgEntityRows(el, { textColor: labelColor, stroke, fontFamily, finish: o.finish });
  // A layer stack, pyramid or cycle's rows (docs/specs/009-elements/concept-graphics.md).
  if (isConceptShape(el.shape))
    return svgConcept(el, { stroke, fill, labelColor, label, fontFamily });
  // A pointer note's leader and tip (docs/specs/009-elements/pointer-note.md); its box and label are the usual.
  if (el.shape === 'pointer-note') return svgPointerNote(el, { stroke });
  // A person node's disc, name and role (docs/specs/009-elements/org-chart.md); its box is the mind node's.
  if (isPersonNode(el)) return svgPersonNode(el, { stroke, labelColor, label, fontFamily });
  // A sequence diagram's picture, fitted (docs/specs/009-elements/sequence-diagram.md).
  // It is drawn in the element's own colours, face and finish (its participants in the accent, its words in the ink).
  if (el.shape === 'sequence')
    return svgSequencePicture(el, {
      paper: fill,
      stroke,
      ink: el.textColor ?? labelColor,
      fontFamily,
      finish: o.finish,
    });
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
  // The Behaviour + Collaborate faces (docs/specs/009-elements/mode-button.md to /137), which all exported
  // as the same blank labelled box as each other.
  return svgFace(
    svgBehaviourFace(el, label, labelColor, stroke, o.surface, o.fill, o.resolveEmojiArt) ??
      svgCollabFace(el, label, labelColor, stroke, o.fill) ??
      '',
    fontFamily,
  );
}
