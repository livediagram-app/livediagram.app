// The hand-drawn finishes (docs/specs/008-canvas/finish.md "Sketch", "Marker") behind one door: an element's body and
// an arrow's line in whichever pen its finish draws with, Sketch's pencil (sketch-element.ts) or Marker's felt-tip
// (marker-element.ts). The canvas and every export call these, so the two pens cannot drift apart between them.
import type { ArrowheadShape, ArrowheadSize } from './arrow-style';
import { finishDrawsBodyByHand, type Finish } from './finish';
import type { BoxedElement } from './index';
import { MARKER_INK_OPACITY } from './marker';
import { markerArrow, markerElementPaint } from './marker-element';
import { sketchArrow, sketchElementPaint } from './sketch-element';

/** An element's hand-drawn body: the drawing (`drawing.pen` says whose), and the width and dash its outline takes. */
export type HandDrawnPaint =
  | NonNullable<ReturnType<typeof sketchElementPaint>>
  | NonNullable<ReturnType<typeof markerElementPaint>>;

/** An element's body in its hand-drawn finish, or null when its finish draws it as it is. */
export function handDrawnElementPaint(
  el: BoxedElement,
  finish: Finish,
  fill: string,
  // Something sits on this shape (sketch-backdrop.ts): a solid fill, never shading.
  backdrop = false,
): HandDrawnPaint | null {
  if (!finishDrawsBodyByHand(finish, el.type)) return null;
  return finish === 'marker'
    ? markerElementPaint(el, fill, backdrop)
    : sketchElementPaint(el, finish, fill, backdrop);
}

/** An arrow drawn by hand. */
export type HandDrawnArrow = {
  /** The line, and a second layer of it (Marker's strokes that cross the first; empty under Sketch). */
  line: string;
  lineOver: string;
  /** The redrawn heads, empty when the caller keeps its markers (`sketchedHeads` false). */
  heads: string;
  sketchedHeads: boolean;
  /** The heads are a solid wedge, filled in the line's colour (Marker's triangle). */
  headFill: boolean;
  /** How see-through the ink is: 1 for Sketch's pencil, MARKER_INK_OPACITY for Marker's. */
  inkOpacity: number;
};

/** An arrow in its hand-drawn finish, or null when the finish draws it as a plain path (or it is too short). */
export function handDrawnArrow(
  finish: Finish,
  id: string,
  pathD: string,
  o: {
    strokePx: number;
    headSize: ArrowheadSize;
    headShape: ArrowheadShape;
    startHead: boolean;
    endHead: boolean;
    /** A flow animation runs on the line: one stroke, so its dash and draw maths hold. */
    flowing: boolean;
  },
): HandDrawnArrow | null {
  const ends = {
    headSize: o.headSize,
    headShape: o.headShape,
    startHead: o.startHead,
    endHead: o.endHead,
  };
  if (finish === 'marker') {
    const m = markerArrow(id, pathD, { ...ends, strokePx: o.strokePx, oneLayer: o.flowing });
    if (!m) return null;
    return {
      line: m.line[0],
      lineOver: m.line[1],
      heads: m.heads,
      sketchedHeads: m.drawnHeads,
      headFill: m.headFill,
      inkOpacity: MARKER_INK_OPACITY,
    };
  }
  if (finish !== 'sketch') return null;
  const s = sketchArrow(id, pathD, { ...ends, strokePx: o.strokePx, passes: o.flowing ? 1 : 2 });
  if (!s) return null;
  return { ...s, lineOver: '', headFill: false, inkOpacity: 1 };
}
