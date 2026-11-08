import { WHITEBOARD_BACKGROUNDS } from '@livediagram/document';
import type { DrawPattern } from '@/lib/whiteboard-dock-prefs';
import { between, frameOf, lerp, type Chapter, type Point, type Topic } from '../topic';
import { dockItem, flyoutOption, handLine, INK_PEN, penStroke, type Stroke } from './draw-shared';

// Erase and Board (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw; docs/specs/023-draw-mode/
// draw-mode.md "Eraser", "Board background"): Erase, Board. Three strokes are on the board; Example picks the Eraser
// (shown in hand from the replay's `dock`) and rubs one out: in Stroke mode, the eraser's default, touching a stroke
// removes it whole. Then it opens the dock's Settings and picks Dots, then Grid: the board shows each from the
// replay's `prefs.drawPattern`, never the person's stored pattern.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'board-erase',
    name: 'Erase',
    shortName: 'Erase',
    ms: 8500,
    say: 'Pick the Eraser and rub over a stroke to remove it.',
    sayTouch: 'Tap the Eraser and rub over a stroke to remove it.',
  },
  {
    id: 'board-background',
    name: 'Board',
    shortName: 'Board',
    ms: 9500,
    say: "The dock's Settings changes the board behind your work.",
    sayTouch: "Tap the dock's Settings to change the board behind your work.",
  },
];

export const ERASE = { pick: 1200, rub: [2600, 4600], gone: 2900, rest: 6000 } as const;
export const BOARD = { cog: 1000, dots: 2600, grid: 4800, close: 6800, rest: 8000 } as const;

// The two backgrounds picked, by their names in the Settings flyout and the patterns they draw
// (packages/document/src/whiteboard.ts WHITEBOARD_BACKGROUNDS).
const patternOf = (id: 'dots' | 'grid') =>
  WHITEBOARD_BACKGROUNDS.find((b) => b.id === id)!.pattern as DrawPattern;
export const DOTS = { label: 'Dots', pattern: patternOf('dots') } as const;
export const GRID = { label: 'Grid', pattern: patternOf('grid') } as const;

export type BoardLayout = {
  readonly strokes: readonly Stroke[];
  // The stroke rubbed out, and the eraser's path back and forth across it.
  readonly erasedId: string;
  readonly rub: readonly Point[];
  readonly rest: Point;
};

const ERASER_IN_HAND = { tool: 'eraser' } as const;

export const board: Topic<BoardLayout> = {
  id: 'draw-board',
  chapters: CHAPTERS,

  layout({ centre: c }) {
    const at = (dx: number, dy: number) => ({ x: c.x + dx, y: c.y + dy });
    const wave = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
      return at(-150 + 300 * t, -200 + 12 * Math.sin(t * Math.PI * 4));
    });
    const scribble = handLine([at(-120, -120), at(-40, -60), at(-110, -40), at(-20, 10)], 10, 2);
    const star = handLine(
      [at(80, -40), at(105, -130), at(130, -40), at(55, -100), at(155, -100), at(80, -40)],
      8,
      1,
    );
    const stroke = (id: string, points: Point[]): Stroke => ({
      id,
      points,
      from: 0,
      to: 0,
      pen: INK_PEN,
    });
    return {
      strokes: [
        stroke('wib-board-wave', wave),
        stroke('wib-board-scribble', scribble),
        stroke('wib-board-star', star),
      ],
      erasedId: 'wib-board-scribble',
      // Side to side across the scribble, as a hand rubs.
      rub: [at(-135, -95), at(-15, -85), at(-130, -55), at(-10, -30), at(-120, -10)],
      rest: at(0, 40),
    };
  },

  frame(index, ms, layout) {
    const drawn = (gone: boolean) =>
      layout.strokes
        .filter((s) => !(gone && s.id === layout.erasedId))
        .map((s) => penStroke(s.id, s.points, s.pen));
    if (index <= 0) {
      const rubbing = ms >= ERASE.rub[0] && ms < ERASE.rub[1];
      return frameOf(drawn(ms >= ERASE.gone), {
        dock: ms >= ERASE.pick ? ERASER_IN_HAND : undefined,
        hold: rubbing ? along(layout.rub, between(ms, ERASE.rub[0], ERASE.rub[1])) : null,
      });
    }
    const pattern = ms >= BOARD.grid ? GRID.pattern : ms >= BOARD.dots ? DOTS.pattern : null;
    return frameOf(drawn(true), {
      dock: ERASER_IN_HAND,
      open: ms >= BOARD.cog && ms < BOARD.close ? ['dock-settings'] : [],
      ...(pattern ? { prefs: { drawPattern: pattern } } : {}),
    });
  },

  plan(index, layout) {
    if (index <= 0)
      return [
        { at: ERASE.pick, to: dockItem('eraser'), press: true },
        { at: ERASE.rub[0], to: { kind: 'canvas', ...layout.rub[0]! } },
        { at: ERASE.rest, to: { kind: 'canvas', ...layout.rest } },
      ];
    return [
      { at: BOARD.cog, to: dockItem('settings'), press: true },
      { at: BOARD.dots, to: flyoutOption('settings', DOTS.label), press: true },
      { at: BOARD.grid, to: flyoutOption('settings', GRID.label), press: true },
      { at: BOARD.close, to: dockItem('settings'), press: true },
      { at: BOARD.rest, to: { kind: 'canvas', ...layout.rest } },
    ];
  },
};

// A point `p` of the way along a path of straight legs, each the same share of the time.
function along(path: readonly Point[], p: number): Point {
  const legs = path.length - 1;
  const at = Math.min(legs - 1e-9, Math.max(0, p * legs));
  const i = Math.floor(at);
  const t = at - i;
  return { x: lerp(path[i]!.x, path[i + 1]!.x, t), y: lerp(path[i]!.y, path[i + 1]!.y, t) };
}
