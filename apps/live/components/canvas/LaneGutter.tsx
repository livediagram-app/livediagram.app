import type { TextAlignX, TextAlignY } from '@livediagram/diagram';

// A lane's title gutter (spec/119): the tinted strip behind its title, with a
// divider where it meets the body.
//
// Only the strip and the rule are drawn here. The TITLE is the element's
// ordinary label, so it edits, formats, aligns and exports exactly like every
// other label — the swimlane template's separate "gutter cells" existed
// precisely because there was nowhere for a title to live on a frame.
//
// The gutter runs along whichever EDGE the title is pinned to, so re-aligning
// the title takes its backdrop with it.

/** Thickness of the title gutter along a lane's side, in element space. */
export const LANE_GUTTER_PX = 132;

// The same idea on the other axis, and a different number because the job is
// different: 132 buys room for words across, while a band only has to hold one
// line down. 24 + 16 + 24 — the lg padding a lane is built with, above and
// below a default (14px) title's line box. A longer or larger title runs past
// the wash exactly as it already runs past the 132 gutter; the band is a
// backdrop, not a clip.
/** Thickness of the title band along a lane's top or bottom, in element space. */
export const LANE_BAND_PX = 64;

export type LaneGutterEdge = 'left' | 'right' | 'top' | 'bottom' | 'centre-x';

/**
 * Which edge the gutter hugs, from the title's alignment alone.
 *
 * A title pinned left or right reads down that edge — the swimlane idiom — and
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

export function LaneGutter({
  stroke,
  alignX,
  alignY,
}: {
  stroke: string;
  alignX: TextAlignX;
  alignY: TextAlignY;
}) {
  // The gutter FOLLOWS the title. Pinning it left while the text moved right
  // left the strip sitting behind nothing and the title floating over the
  // work — the tinted band is the title's backdrop, so it goes where the
  // title goes.
  const edge = laneGutterEdge(alignX, alignY);
  const band = isLaneBand(edge);

  // Only an edge-hugging gutter inherits the lane's corner radius; a centred
  // one has square sides by definition.
  const radius =
    edge === 'right'
      ? 'rounded-r-[inherit]'
      : edge === 'left'
        ? 'rounded-l-[inherit]'
        : edge === 'top'
          ? 'rounded-t-[inherit]'
          : edge === 'bottom'
            ? 'rounded-b-[inherit]'
            : '';

  const placement =
    edge === 'right'
      ? { right: 0, borderLeft: `1px solid ${stroke}` }
      : edge === 'left'
        ? { left: 0, borderRight: `1px solid ${stroke}` }
        : edge === 'top'
          ? { top: 0, borderBottom: `1px solid ${stroke}` }
          : edge === 'bottom'
            ? { bottom: 0, borderTop: `1px solid ${stroke}` }
            : // A centred strip gets a rule on BOTH sides: it has two seams
              // with the body, not one.
              {
                left: `calc(50% - ${LANE_GUTTER_PX / 2}px)`,
                borderLeft: `1px solid ${stroke}`,
                borderRight: `1px solid ${stroke}`,
              };

  return (
    <div
      // Inert: the label sits on top of this and the canvas owns the rest.
      className={`pointer-events-none absolute ${band ? 'inset-x-0' : 'inset-y-0'} ${radius}`}
      style={{
        ...(band ? { height: LANE_BAND_PX } : { width: LANE_GUTTER_PX }),
        // A wash of the lane's own stroke colour rather than a fixed grey, so
        // a recoloured lane keeps its gutter in the family.
        backgroundColor: stroke,
        opacity: 0.1,
        ...placement,
      }}
      aria-hidden
    />
  );
}
