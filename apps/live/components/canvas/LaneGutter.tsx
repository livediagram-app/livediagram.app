import type { TextAlignX } from '@livediagram/diagram';

// A lane's title gutter (spec/119): the tinted strip behind its title, with a
// divider where it meets the body.
//
// Only the strip and the rule are drawn here. The TITLE is the element's
// ordinary label, so it edits, formats, aligns and exports exactly like every
// other label — the swimlane template's separate "gutter cells" existed
// precisely because there was nowhere for a title to live on a frame.
//
// Which SIDE the strip sits on follows the label's horizontal alignment, so
// re-aligning the title takes its backdrop with it.

/** Width of the title gutter, in element space. */
export const LANE_GUTTER_PX = 132;

export function LaneGutter({ stroke, alignX }: { stroke: string; alignX: TextAlignX }) {
  // The gutter FOLLOWS the title. Pinning it left while the text moved right
  // left the strip sitting behind nothing and the title floating over the
  // work — the tinted band is the title's backdrop, so it goes where the
  // title goes.
  const side =
    alignX === 'right'
      ? { right: 0, borderLeft: `1px solid ${stroke}` }
      : alignX === 'center'
        ? { left: `calc(50% - ${LANE_GUTTER_PX / 2}px)` }
        : { left: 0, borderRight: `1px solid ${stroke}` };
  return (
    <div
      // Inert: the label sits on top of this and the canvas owns the rest.
      className={`pointer-events-none absolute inset-y-0 ${
        // Only an edge-hugging gutter inherits the lane's corner radius; a
        // centred one has square sides by definition.
        alignX === 'right'
          ? 'rounded-r-[inherit]'
          : alignX === 'center'
            ? ''
            : 'rounded-l-[inherit]'
      }`}
      style={{
        width: LANE_GUTTER_PX,
        // A wash of the lane's own stroke colour rather than a fixed grey, so
        // a recoloured lane keeps its gutter in the family.
        backgroundColor: stroke,
        opacity: 0.1,
        // A centred strip gets a rule on BOTH sides: it has two seams with
        // the body, not one.
        ...(alignX === 'center'
          ? { borderLeft: `1px solid ${stroke}`, borderRight: `1px solid ${stroke}` }
          : {}),
        ...side,
      }}
      aria-hidden
    />
  );
}
