import { frameOf, type Chapter, type Point, type Topic } from '../topic';
import { dockItem, handLine, inkAt, INK_PEN, penInHand, type Stroke } from './draw-shared';

// Sketch (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw): Pick Up, Draw. Example presses the first
// marker on the dock (shown in hand from the replay's `dock`, never picked up for real), then draws a wavy line and a
// little house in it, each stroke growing under the cursor.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'sketch-pick-up',
    name: 'Pick Up',
    shortName: 'Pick Up',
    ms: 4000,
    say: 'Click a marker on the dock to pick it up.',
    sayTouch: 'Tap a marker on the dock to pick it up.',
  },
  {
    id: 'sketch-draw',
    name: 'Draw',
    shortName: 'Draw',
    ms: 16000,
    say: 'Drag on the board to draw; the marker stays in hand.',
    sayTouch: 'Drag a finger or a pen on the board to draw.',
  },
];

// The marker pressed: Marker 1, the dock's first (DrawingToolsGroup.tsx, its `data-dock-item` the pen id).
export const MARKER = 'main';
export const PICK_UP = { press: 1200 } as const;
// The Draw chapter's strokes, in ms: the line, the walls, the roof, the door.
export const DRAW = {
  line: [300, 3000],
  walls: [4000, 8000],
  roof: [8800, 10800],
  door: [11600, 13200],
  rest: 14600,
} as const;

export type SketchLayout = {
  readonly strokes: readonly Stroke[];
  // Where Example rests after the house, beside it.
  readonly rest: Point;
};

export const sketch: Topic<SketchLayout> = {
  id: 'draw-sketch',
  chapters: CHAPTERS,

  layout({ centre: c }) {
    const at = (dx: number, dy: number) => ({ x: c.x + dx, y: c.y + dy });
    const line = Array.from({ length: 48 }, (_, i) => {
      const t = i / 47;
      return at(-160 + 320 * t, -205 + 14 * Math.sin(t * Math.PI * 3));
    });
    const walls = handLine([at(-70, -80), at(-72, 40), at(70, 42), at(68, -80), at(-70, -80)], 12);
    const roof = handLine([at(-86, -76), at(0, -150), at(86, -76)], 12);
    const door = handLine([at(-16, 42), at(-16, -6), at(16, -6), at(16, 42)], 6, 1);
    const stroke = (
      id: string,
      points: Point[],
      [from, to]: readonly [number, number],
    ): Stroke => ({
      id,
      points,
      from,
      to,
      pen: INK_PEN,
    });
    return {
      strokes: [
        stroke('wib-sketch-line', line, DRAW.line),
        stroke('wib-sketch-walls', walls, DRAW.walls),
        stroke('wib-sketch-roof', roof, DRAW.roof),
        stroke('wib-sketch-door', door, DRAW.door),
      ],
      rest: at(130, -20),
    };
  },

  frame(index, ms, layout) {
    if (index <= 0)
      return frameOf([], { dock: ms >= PICK_UP.press ? penInHand(MARKER) : undefined });
    const { elements, hold } = inkAt(layout.strokes, ms);
    return frameOf(elements, { hold, dock: penInHand(MARKER) });
  },

  plan(index, layout) {
    const start = (i: number) => {
      const s = layout.strokes[i]!;
      return { at: s.from, to: { kind: 'canvas', ...s.points[0]! } } as const;
    };
    if (index <= 0)
      return [
        { at: PICK_UP.press, to: dockItem(MARKER), press: true },
        { at: 3600, to: { kind: 'canvas', ...layout.strokes[0]!.points[0]! } },
      ];
    return [
      start(0),
      start(1),
      start(2),
      start(3),
      { at: DRAW.rest, to: { kind: 'canvas', ...layout.rest } },
    ];
  },
};
