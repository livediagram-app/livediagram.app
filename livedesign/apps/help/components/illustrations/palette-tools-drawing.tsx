// Drawing-gesture illustrations (docs/specs/008-canvas/polygon-tool.md): the Polygon tool's click-to-place
// vertices. Split out from palette-tools.tsx (already at size) per the no-god-files rule; composed only from the
// shared primitives.

import { Scene, Cursor, Panel, Label } from './primitives';

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
  // Inside the 12px snap range that shows the ring (POLYGON_CLOSE_PX).
  const cursor: [number, number] = [128, 157];
  return (
    <Scene w={420} h={220}>
      {/* Mode banner, with the editor's exact desktop wording (lib/draw-mode.ts) */}
      <Panel x={8} y={14} w={404} h={30}>
        <circle cx={22} cy={29} r={5} className="fill-brand-500" />
        <Label x={33} y={30} size={9.5} weight={600} tone="body">
          Click to place points, click the start to close, double-click to finish
        </Label>
        <Label x={370} y={30} size={9.5} weight={600} tone="muted">
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
      {/* Below the cursor, clear of the ring and the pointer */}
      <Label x={120} y={200} anchor="middle" size={11} tone="muted">
        click the start to close
      </Label>
    </Scene>
  );
}
