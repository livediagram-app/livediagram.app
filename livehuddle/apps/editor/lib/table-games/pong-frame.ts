// Where a Ping-Pong Table's game lies on the drawing its facing shows (docs/specs/009-elements/furniture-facing.md
// "Live faces", social-pieces.md "Controls"). The game itself (ping-pong.ts) knows no facing: its play area is 0 to 1
// along the table (from the left seat's end) and 0 to 1 across it, the axis a paddle moves on. This maps that area onto
// the turned table: its back plays as its front with the ends swapped (the left seat sits at the right end then), and
// on its side the ends are at the top and the bottom and the paddles move across the canvas. So every screen draws
// the same rally on the same table, and a player's keys and pointer move their paddle the way it moves on screen.
// Pure.

import { facingView, type SeatFacing } from '@livehuddle/avatar/facing';
import { OFFICE_ART, PING_PONG_TOP, PING_PONG_TOP_SIDE } from '@livehuddle/document';

type Box = { x: number; y: number; w: number; h: number };

export type PongFrame = {
  /** The drawing's grid: the overlay's viewBox. */
  grid: { width: number; height: number };
  /** The table top on the grid. */
  table: Box;
  /** The screen axis the paddles move along: down the canvas (`y`, the ends left and right) or across it (`x`). */
  across: 'x' | 'y';
  /** Where a play-area point (`along` the table from the left seat's end, `side` across it) lands on the grid. */
  at(along: number, side: number): { x: number; y: number };
};

const ART = OFFICE_ART['ping-pong-table'];

/** The game's frame on the drawing a facing shows. */
export function pongFrame(facing: SeatFacing): PongFrame {
  const { view, mirrored } = facingView(facing);
  if (view === 'side') {
    const grid = ART.side;
    // The drawing is mirrored for facing right, so its table top is too; across it the paddle still runs left to
    // right on screen, so the keys and the pointer read the same at either side.
    const table: Box = mirrored
      ? { ...PING_PONG_TOP_SIDE, x: grid.width - PING_PONG_TOP_SIDE.x - PING_PONG_TOP_SIDE.w }
      : { ...PING_PONG_TOP_SIDE };
    return {
      grid,
      table,
      across: 'x',
      at: (along, side) => ({ x: table.x + side * table.w, y: table.y + along * table.h }),
    };
  }
  const grid = ART[view];
  const table: Box = { ...PING_PONG_TOP };
  const back = view === 'back';
  return {
    grid,
    table,
    across: 'y',
    at: (along, side) => ({
      x: table.x + (back ? 1 - along : along) * table.w,
      y: table.y + side * table.h,
    }),
  };
}

/** How long a paddle is drawn, on the grid: the model's length across the table. */
export function paddleLength(frame: PongFrame, half: number): number {
  return half * 2 * (frame.across === 'y' ? frame.table.h : frame.table.w);
}

/**
 * The paddle under a pointer, 0 to 1 across the table, from where it is over the drawing's box on screen (the
 * overlay's svg): its height on a table facing down or up, its distance across on a table on its side.
 */
export function framePointerAxis(
  frame: PongFrame,
  e: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
): number {
  const { grid, table } = frame;
  const [client, start, span, at, length] =
    frame.across === 'y'
      ? [e.clientY, box.top, box.height / grid.height, table.y, table.h]
      : [e.clientX, box.left, box.width / grid.width, table.x, table.w];
  const size = length * span;
  return size > 0 ? (client - (start + at * span)) / size : 0.5;
}

const KEYS: Record<'x' | 'y', { less: ReadonlySet<string>; more: ReadonlySet<string> }> = {
  y: { less: new Set(['w', 'W', 'ArrowUp']), more: new Set(['s', 'S', 'ArrowDown']) },
  x: { less: new Set(['a', 'A', 'ArrowLeft']), more: new Set(['d', 'D', 'ArrowRight']) },
};

/**
 * Which way a key moves your paddle on a table whose paddles move along `across`: -1 toward 0 (up, or left), 1
 * toward 1, 0 for a key that is not the paddle's (any key held with a modifier is not).
 */
export function paddleKey(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  across: 'x' | 'y',
): -1 | 0 | 1 {
  if (e.metaKey || e.ctrlKey || e.altKey) return 0;
  const keys = KEYS[across];
  return keys.less.has(e.key) ? -1 : keys.more.has(e.key) ? 1 : 0;
}
