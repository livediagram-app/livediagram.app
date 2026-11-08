import type { Element, ShapeElement } from '@livediagram/document';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import { frameOf, type Chapter, type Point, type Topic } from '../topic';
import {
  dockItem,
  flyoutOption,
  handLine,
  inkAt,
  INK_PEN,
  penInHand,
  recognised,
  snappedShape,
  wobble,
  type Stroke,
} from './draw-shared';

// Shape Recognition (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw; docs/specs/023-draw-mode/
// draw-mode.md "Shape recognition"): Turn On, Hold, Again. Example turns Shape recognition on in the dock's Settings
// (shown from the replay's `dock`, never stored), then draws a wobbly circle and rests: half a second still and the
// stroke is the clean shape the board's own test reads it as, landing as the pen lands it.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'recognition-turn-on',
    name: 'Turn On',
    shortName: 'On',
    ms: 6000,
    say: "Turn on Shape recognition in the dock's Settings.",
    sayTouch: "Tap the dock's Settings, then Shape recognition.",
  },
  {
    id: 'recognition-hold',
    name: 'Hold',
    shortName: 'Hold',
    ms: 7000,
    say: 'Draw a shape and hold still: it snaps clean. Press Alt to snap it at once.',
    sayTouch: 'Draw a shape and hold still: it snaps clean, or tap Make Shape.',
  },
  {
    id: 'recognition-again',
    name: 'Again',
    shortName: 'Again',
    ms: 6000,
    say: 'A rough box becomes a rectangle the same way.',
    sayTouch: 'A rough box becomes a rectangle the same way.',
  },
];

// The Settings flyout's Drawing option (dock-flyouts.tsx SettingsFlyoutBody).
export const RECOGNITION_OPTION = 'Shape recognition';
export const TURN_ON = { cog: 1000, option: 2400, close: 3800, toBoard: 5400 } as const;
// Each stroke's beats in its chapter: drawn, held still (the snap comes RECOGNITION_PREVIEW_DWELL_MS later), lifted.
export const HOLD = {
  draw: [300, 3300],
  snap: 3300 + RECOGNITION_PREVIEW_DWELL_MS,
  lift: 4600,
  away: 5800,
} as const;
export const AGAIN = {
  draw: [300, 3000],
  snap: 3000 + RECOGNITION_PREVIEW_DWELL_MS,
  lift: 4200,
  away: 5200,
} as const;

export type RecognitionLayout = {
  readonly circle: Stroke;
  readonly box: Stroke;
  // What each stroke lands as: the board's own reading of it.
  readonly ellipse: ShapeElement;
  readonly rectangle: ShapeElement;
  readonly rest: Point;
};

const IDS = {
  circle: 'wib-recognition-circle',
  box: 'wib-recognition-box',
  ellipse: 'wib-recognition-ellipse',
  rectangle: 'wib-recognition-rectangle',
} as const;

// Shape recognition shown on: the marker in hand, the setting on.
const on = penInHand('main', { prefs: { recognise: true } });

export const recognition: Topic<RecognitionLayout> = {
  id: 'draw-recognition',
  chapters: CHAPTERS,

  layout({ centre: c }) {
    const at = (dx: number, dy: number) => ({ x: c.x + dx, y: c.y + dy });
    // A circle by hand: once round from the top and a little past, a few px off true.
    const circlePts = Array.from({ length: 56 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 55) * (Math.PI * 2 + 0.3);
      const r = 1 + wobble(i, 0.05);
      return at(-95 + 70 * r * Math.cos(a), -90 + 62 * r * Math.sin(a));
    });
    const boxPts = handLine(
      [at(30, -150), at(170, -146), at(166, -30), at(28, -34), at(32, -146)],
      12,
      3,
    );
    const circle: Stroke = {
      id: IDS.circle,
      points: circlePts,
      from: HOLD.draw[0],
      to: HOLD.lift,
      pen: INK_PEN,
    };
    const box: Stroke = {
      id: IDS.box,
      points: boxPts,
      from: AGAIN.draw[0],
      to: AGAIN.lift,
      pen: INK_PEN,
    };
    const read = (s: Stroke, id: string, fallback: 'circle' | 'square') =>
      snappedShape(
        id,
        recognised(s.points, s.pen) ?? { kind: fallback, confidence: 1, bbox: boxOf(s.points) },
        s.pen,
      );
    return {
      circle,
      box,
      ellipse: read(circle, IDS.ellipse, 'circle'),
      rectangle: read(box, IDS.rectangle, 'square'),
      rest: at(0, 40),
    };
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    if (id === 'recognition-turn-on') {
      return frameOf([], {
        open: ms >= TURN_ON.cog && ms < TURN_ON.close ? ['dock-settings'] : [],
        dock: penInHand('main', { prefs: { recognise: ms >= TURN_ON.option } }),
      });
    }
    if (id === 'recognition-hold') {
      return frameOf(drawnOrSnapped(layout.circle, layout.ellipse, ms, HOLD), {
        hold: held(layout.circle, ms, HOLD),
        dock: on,
      });
    }
    return frameOf([layout.ellipse, ...drawnOrSnapped(layout.box, layout.rectangle, ms, AGAIN)], {
      hold: held(layout.box, ms, AGAIN),
      dock: on,
    });
  },

  plan(index, layout) {
    const id = CHAPTERS[index]?.id ?? 'recognition-turn-on';
    const startOf = (s: Stroke) => ({ kind: 'canvas', ...s.points[0]! }) as const;
    if (id === 'recognition-hold')
      return [
        { at: HOLD.draw[0], to: startOf(layout.circle) },
        { at: HOLD.away, to: { kind: 'canvas', ...layout.rest } },
      ];
    if (id === 'recognition-again')
      return [
        { at: AGAIN.draw[0], to: startOf(layout.box) },
        { at: AGAIN.away, to: { kind: 'canvas', ...layout.rest } },
      ];
    return [
      { at: TURN_ON.cog, to: dockItem('settings'), press: true },
      { at: TURN_ON.option, to: flyoutOption('settings', RECOGNITION_OPTION), press: true },
      { at: TURN_ON.toBoard, to: startOf(layout.circle) },
    ];
  },
};

type Beats = {
  readonly draw: readonly [number, number];
  readonly snap: number;
  readonly lift: number;
};

// The stroke as drawn, held still at its end, then from the snap on the shape it reads as.
function drawnOrSnapped(stroke: Stroke, shape: ShapeElement, ms: number, beats: Beats): Element[] {
  if (ms >= beats.snap) return [shape];
  return inkAt([{ ...stroke, to: beats.draw[1] }], ms).elements;
}

// Example holds the pen down from the first point until the lift: on the tip while drawing, still at the end after.
function held(stroke: Stroke, ms: number, beats: Beats): Point | null {
  if (ms < beats.draw[0] || ms >= beats.lift) return null;
  return (
    inkAt([{ ...stroke, to: beats.draw[1] }], Math.min(ms, beats.draw[1])).hold ??
    stroke.points.at(-1)!
  );
}

function boxOf(points: readonly Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
