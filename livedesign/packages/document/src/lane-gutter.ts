// A lane's title gutter (docs/specs/009-elements/lane.md): which edge it hugs and how thick it is.
//
// In the document package because BOTH renderers need it: the canvas draws the
// strip, and the headless SVG render (exports, thumbnails, the MCP render) has
// to draw the same strip on the same edge, or an exported swimlane is a plain
// box with its title floating in the middle of the work. The editor's
// LaneGutter component owns the drag / snapping; only the geometry is here.

import type { TextAlignX, TextAlignY } from './index';

/** Thickness of the title gutter along a lane's side, in element space. */
export const LANE_GUTTER_PX = 132;

// The same idea on the other axis, and a different number because the job is
// different: 132 buys room for words across, while a band only has to hold one
// line down.
/** Thickness of the title band along a lane's top or bottom, in element space. */
export const LANE_BAND_PX = 64;

export type LaneGutterEdge = 'left' | 'right' | 'top' | 'bottom' | 'centre-x';

/** The bits of a lane the geometry reads. Structural, so an Element satisfies
 *  it without a cast. */
export type LaneLike = {
  textAlignX?: TextAlignX | undefined;
  textAlignY?: TextAlignY | undefined;
  headerSize?: number | undefined;
  titleOrientation?: 'upright' | undefined;
};

/**
 * Which edge the gutter hugs, from the title's alignment alone.
 *
 * A title pinned left or right reads down that edge (the swimlane idiom) and
 * that holds at any vertical position, so the horizontal pin wins whenever
 * there is one. Only a title with no horizontal edge to hug lets the vertical
 * pin decide, which is what turns the lane on its side: centred at the top or
 * bottom, the gutter becomes a header band and the lane reads as a column.
 * Centred both ways keeps the strip down the middle, which is the one case
 * where neither axis is pinned.
 */
export function laneGutterEdge(alignX: TextAlignX, alignY: TextAlignY): LaneGutterEdge {
  if (alignX === 'left') return 'left';
  if (alignX === 'right') return 'right';
  if (alignY === 'top') return 'top';
  if (alignY === 'bottom') return 'bottom';
  return 'centre-x';
}

/** True when the gutter lies across the lane rather than down it. */
export function isLaneBand(edge: LaneGutterEdge): boolean {
  return edge === 'top' || edge === 'bottom';
}

/** A lane's gutter edge, from the element. */
export function laneEdgeOfElement(el: LaneLike): LaneGutterEdge {
  return laneGutterEdge(el.textAlignX ?? 'center', el.textAlignY ?? 'middle');
}

/**
 * Whether the title reads turned a quarter, bottom to top (docs/specs/009-elements/lane.md
 * "Upright titles"): the lane asks for it and its strip runs down a side. A band across the top or
 * bottom always reads across.
 */
export function isUprightTitle(el: LaneLike): boolean {
  return el.titleOrientation === 'upright' && !isLaneBand(laneEdgeOfElement(el));
}

/** A lane's heading thickness, defaulted by orientation: one line for a band or an upright strip. */
export function laneSizeOfElement(el: LaneLike): number {
  return (
    el.headerSize ??
    (isLaneBand(laneEdgeOfElement(el)) || isUprightTitle(el) ? LANE_BAND_PX : LANE_GUTTER_PX)
  );
}

/** An upright title's strip in element space, and where the title sits along it. */
export type UprightTitleStrip = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The title's alignment along the strip, read bottom to top: the vertical pin, turned. */
  alongAlign: TextAlignX;
};

const ALONG: Record<TextAlignY, TextAlignX> = { top: 'right', middle: 'center', bottom: 'left' };

/**
 * Where an upright title draws (docs/specs/009-elements/lane.md "Upright titles"): its side strip,
 * clamped like the gutter, with the vertical pin turned into an alignment along the strip. Both
 * renderers turn a box `height` wide and `width` tall a quarter anticlockwise into this strip.
 */
export function uprightTitleStrip(el: LaneLike, width: number, height: number): UprightTitleStrip {
  const edge = laneEdgeOfElement(el);
  const size = Math.min(Math.max(laneSizeOfElement(el), 0), width);
  const x = edge === 'right' ? width - size : edge === 'centre-x' ? (width - size) / 2 : 0;
  return { x, y: 0, width: size, height, alongAlign: ALONG[el.textAlignY ?? 'middle'] };
}
