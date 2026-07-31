// A lane's title gutter (spec/119): the tinted strip down its left edge, with
// the divider where it meets the body.
//
// Only the strip and the rule are drawn here. The TITLE is the element's
// ordinary label, left-aligned and vertically centred by the factory defaults,
// so it edits, formats, aligns and exports exactly like every other label —
// the swimlane template's separate "gutter cells" existed precisely because
// there was nowhere for a title to live on a frame.

/** Width of the title gutter, in element space. */
export const LANE_GUTTER_PX = 132;

export function LaneGutter({ stroke }: { stroke: string }) {
  return (
    <div
      // Inert: the label sits on top of this and the canvas owns the rest.
      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[inherit]"
      style={{
        width: LANE_GUTTER_PX,
        // A wash of the lane's own stroke colour rather than a fixed grey, so
        // a recoloured lane keeps its gutter in the family.
        backgroundColor: stroke,
        opacity: 0.1,
        borderRight: `1px solid ${stroke}`,
      }}
      aria-hidden
    />
  );
}
