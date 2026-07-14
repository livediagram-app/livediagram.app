// Drawing-gesture illustrations for the Tools tab (spec/81 + spec/84): the
// Highlighter's wide translucent marker stroke and the Polygon tool's
// click-to-place vertices. Split out from palette-tools.tsx (already at size)
// per the no-god-files rule; composed only from the shared primitives.

import { Scene, Shape, Cursor, Panel, Label } from './primitives';

/** A wide translucent yellow highlighter stroke swiped across a shape, with
 *  the "Drag to highlight" mode banner. The content underneath stays legible. */
export function HighlighterStroke() {
  return (
    <Scene w={420} h={220}>
      {/* Mode banner */}
      <Panel x={110} y={18} w={200} h={30}>
        <circle cx={128} cy={33} r={6} className="fill-amber-400" />
        <Label x={142} y={34} size={11} weight={600} tone="body">
          Drag to highlight
        </Label>
        <Label x={272} y={34} size={11} weight={600} tone="muted">
          Cancel
        </Label>
      </Panel>
      {/* Diagram content being reviewed */}
      <Shape x={70} y={92} w={120} h={52} label="Sign up" />
      <Shape x={240} y={92} w={120} h={52} label="Checkout" />
      {/* The marker swipe: wide, round-capped, translucent so the label shows through */}
      <path
        d="M226 128 C258 100 342 98 372 124 C344 148 254 152 226 128 Z"
        fill="none"
        className="stroke-amber-300"
        strokeOpacity={0.55}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* A second, overlapping underline darkens where strokes cross */}
      <path
        d="M248 158 h108"
        className="stroke-amber-300"
        strokeOpacity={0.55}
        strokeWidth={13}
        strokeLinecap="round"
      />
      <Cursor x={368} y={166} colour="brand" />
    </Scene>
  );
}

/** The Polygon tool mid-draw: placed vertices joined by straight segments, a
 *  dashed rubber-band segment to the cursor, and a snap ring on the start
 *  vertex showing the loop is ready to close. */
export function PolygonDraw() {
  const placed: [number, number][] = [
    [120, 150],
    [170, 74],
    [268, 62],
    [330, 118],
  ];
  const cursor: [number, number] = [136, 158];
  return (
    <Scene w={420} h={220}>
      {/* Mode banner */}
      <Panel x={86} y={14} w={248} h={30}>
        <circle cx={104} cy={29} r={6} className="fill-brand-500" />
        <Label x={118} y={30} size={11} weight={600} tone="body">
          Click to place points
        </Label>
        <Label x={296} y={30} size={11} weight={600} tone="muted">
          Cancel
        </Label>
      </Panel>
      {/* Placed straight segments */}
      <path
        d={`M${placed.map(([x, y]) => `${x} ${y}`).join(' L')}`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* Rubber-band segment from the last vertex to the cursor */}
      <path
        d={`M330 118 L${cursor[0]} ${cursor[1]}`}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      {/* Snap ring on the start vertex: in range, ready to close */}
      <circle cx={120} cy={150} r={11} className="fill-none stroke-brand-400" strokeWidth={1.5} />
      {/* Vertex dots */}
      {placed.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={4}
          className="fill-white stroke-brand-500"
          strokeWidth={2}
        />
      ))}
      <Cursor x={cursor[0]} y={cursor[1]} colour="brand" />
      <Label x={120} y={178} anchor="middle" size={11} tone="muted">
        click the start to close
      </Label>
    </Scene>
  );
}
