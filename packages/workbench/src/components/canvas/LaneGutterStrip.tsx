import { isLaneBand, type LaneGutterEdge } from '@liveworkspace/element-model/lane-gutter';

// A lane's title gutter on the canvas (docs/specs/009-elements/lane.md, in livediagram and liveplanner): the tinted
// strip behind its title, with a divider where it meets the body, on the edge the title is pinned to. Only the strip:
// the title is the element's ordinary label, laid out over it (lane-title-frame.ts). livediagram's LaneGutter adds
// the seam someone drags to size it; liveplanner's canvas draws the strip alone, read-only, as its export does.

export function LaneGutterStrip({
  stroke,
  headerFill,
  edge,
  size,
}: {
  // The lane's own stroke: the divider's colour, and the strip's 10% wash when no heading colour is set.
  stroke: string;
  // An explicit heading background (`headerFill`), painted at full strength.
  headerFill?: string | undefined;
  // Which edge the strip hugs (laneGutterEdge).
  edge: LaneGutterEdge;
  // Its thickness in element space (laneDrawnSize at rest, the live size during a seam drag).
  size: number;
}) {
  const band = isLaneBand(edge);
  // Only an edge-hugging gutter inherits the lane's corner radius; a centred one has square sides by definition.
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
            : // A centred strip gets a rule on BOTH sides: it has two seams with the body, not one.
              {
                left: `calc(50% - ${size / 2}px)`,
                borderLeft: `1px solid ${stroke}`,
                borderRight: `1px solid ${stroke}`,
              };
  return (
    <div
      // Inert: the label sits on top of this and the canvas owns the rest. Named for the Lane tour to ring.
      data-lane-gutter=""
      className={`pointer-events-none absolute ${band ? 'inset-x-0' : 'inset-y-0'} ${radius}`}
      style={{
        ...(band ? { height: size } : { width: size }),
        // An explicit heading colour paints at full strength (you picked it, you get it); with none set it stays the
        // 10% wash of the lane's own stroke, so a recoloured lane keeps its gutter in the family.
        backgroundColor: headerFill ?? stroke,
        ...(headerFill ? null : { opacity: 0.1 }),
        ...placement,
      }}
      aria-hidden
    />
  );
}
