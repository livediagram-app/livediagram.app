// Drawing-gesture illustrations (docs/specs/008-canvas/highlighter.md + docs/specs/008-canvas/polygon-tool.md): the Highlighter
// row in the palette's Draw category, its wide translucent marker stroke, and
// the Polygon tool's click-to-place vertices.
// Split out from palette-tools.tsx (already at size) per the no-god-files
// rule; composed only from the shared primitives.

import { Scene, Shape, Cursor, Panel, Label, SelectionBox } from './primitives';
import { PaletteCategoryPanel } from './palette-rows';

/** The palette's Draw category with the Highlighter row armed, the "Drag to
 *  highlight" banner up, and the one stroke it lays down mid-drag across a
 *  label that stays legible through it. The rows are the real layout: caption,
 *  blurb and key (apps/live/components/palette/PaletteToolRows.tsx). */
export function HighlighterTile() {
  return (
    <Scene w={420} h={258}>
      <PaletteCategoryPanel x={10} y={14} w={250} category="Draw" active="Highlighter" />
      {/* Mode banner, up until the one stroke lands */}
      <Panel x={270} y={30} w={144} h={30}>
        <Label x={280} y={46} size={10} weight={600} tone="body">
          Drag to highlight
        </Label>
        <Label x={406} y={46} anchor="end" size={10} weight={600} tone="muted">
          Cancel
        </Label>
      </Panel>
      <Shape x={282} y={140} w={120} h={46} label="Checkout" />
      {/* The marker is translucent, so the label stays legible through it. */}
      <path
        d="M290 168 C320 162 360 162 396 166"
        fill="none"
        className="stroke-amber-300"
        strokeOpacity={0.55}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Cursor x={396} y={166} colour="brand" />
    </Scene>
  );
}

/** One committed highlighter stroke swiped around a shape: wide, translucent
 *  (the label underneath stays legible), and selected like any other element,
 *  because the tile puts itself down once the stroke lands. */
export function HighlighterStroke() {
  return (
    <Scene w={420} h={220}>
      {/* Diagram content being reviewed */}
      <Shape x={70} y={92} w={120} h={52} label="Sign up" />
      <Shape x={240} y={92} w={120} h={52} label="Checkout" />
      {/* The marker swipe: wide, round-capped, translucent so the label shows through */}
      <path
        d="M226 128 C258 100 342 98 372 124 C344 148 254 152 226 128 Z"
        fill="none"
        className="stroke-amber-300"
        strokeOpacity={0.55}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Selected on release, ready to move, resize or recolour */}
      <SelectionBox x={216} y={90} w={166} h={66} />
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
