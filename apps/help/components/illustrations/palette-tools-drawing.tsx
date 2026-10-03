// Drawing-gesture illustrations (docs/specs/008-canvas/highlighter.md + docs/specs/008-canvas/polygon-tool.md): the Highlighter
// tile in the palette's Draw category, its wide translucent marker stroke, and
// the Polygon tool's click-to-place vertices.
// Split out from palette-tools.tsx (already at size) per the no-god-files
// rule; composed only from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Shape, Cursor, Panel, Label, SelectionBox, Tile } from './primitives';

// --- Draw-category tile glyphs ------------------------------------------------
//
// Drawn at the tile's centre (the tile translates to its own origin), lit
// white on the active tile like the mode-row glyphs.

function DrawGlyph({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <g
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={1.5}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </g>
  );
}

/** A chisel-tip marker over the band it lays down (Highlighter). The band is
 *  what tells it apart from a pen at this size, where both nibs are the same
 *  three strokes. */
function HighlighterGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-5 3 L0 -2 L2.5 0.5 L-2.5 5.5 Z" />
      <path d="M0 -2 L2 -4.5 L5 -1.5 L2.5 0.5" />
      <path d="M-6 7 H1" strokeWidth={2.4} opacity={0.5} />
    </DrawGlyph>
  );
}

function FreehandGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-6 3 C-3 -6 0 6 3 -2 S6 -4 7 -3" />
    </DrawGlyph>
  );
}

function ShapePenGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-5 2 C-6 -4 3 -7 5 -2 C7 3 0 7 -4 4" />
    </DrawGlyph>
  );
}

function PolygonGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-6 4 L-3 -5 L5 -4 L6 4 Z" />
    </DrawGlyph>
  );
}

function ArrowGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-6 5 L5 -5 M0 -5 H5 V0" />
    </DrawGlyph>
  );
}

function LineGlyph({ on = false }: { on?: boolean }) {
  return (
    <DrawGlyph on={on}>
      <path d="M-6 5 L6 -5" />
    </DrawGlyph>
  );
}

// The Draw category in the palette's own order (docs/specs/008-canvas/highlighter.md):
// the Highlighter sits third, after the two pens.
const DRAW_TILES = [
  { key: 'freehand', label: 'Freehand', Glyph: FreehandGlyph },
  { key: 'shape-pen', label: 'Shape Pen', Glyph: ShapePenGlyph },
  { key: 'highlighter', label: 'Highlighter', Glyph: HighlighterGlyph },
  { key: 'polygon', label: 'Polygon', Glyph: PolygonGlyph },
  { key: 'arrow', label: 'Arrow', Glyph: ArrowGlyph },
  { key: 'line', label: 'Line', Glyph: LineGlyph },
] as const;

/** The palette's Draw category with the Highlighter tile picked, the "Drag to
 *  highlight" banner up, and the one stroke it lays down mid-drag across a
 *  label that stays legible through it. */
export function HighlighterTile() {
  const gap = 44;
  return (
    <Scene w={420} h={250}>
      <Panel x={24} y={14} w={DRAW_TILES.length * gap - (gap - 26) + 28} h={88} title="DRAW">
        {DRAW_TILES.map((t, i) => {
          const on = t.key === 'highlighter';
          return (
            <Tile key={t.key} x={38 + i * gap} y={44} active={on} label={t.label}>
              <t.Glyph on={on} />
            </Tile>
          );
        })}
      </Panel>
      {/* Mode banner, up until the one stroke lands */}
      <Panel x={190} y={116} w={206} h={30}>
        <circle cx={208} cy={131} r={6} className="fill-brand-500" />
        <Label x={222} y={132} size={11} weight={600} tone="body">
          Drag to highlight
        </Label>
        <Label x={358} y={132} size={11} weight={600} tone="muted">
          Cancel
        </Label>
      </Panel>
      {/* The band goes down FIRST so the labels draw over it: a highlight
          sits under what it marks, not on top of it. */}
      <path
        d="M228 202 C262 196 316 196 344 200"
        fill="none"
        className="stroke-amber-300"
        strokeOpacity={0.6}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Shape x={60} y={176} w={120} h={48} label="Sign up" />
      <Shape x={226} y={176} w={124} h={48} accent label="Checkout" />
      <Cursor x={344} y={200} colour="brand" />
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
