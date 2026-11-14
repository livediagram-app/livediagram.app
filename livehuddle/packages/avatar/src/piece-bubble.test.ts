import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  boxesOverlap,
  bubbleAbove,
  bubbleBeside,
  bubbleSide,
  PIECE_BUBBLE,
  signGrid,
  sideInView,
  signsNear,
} from './piece-bubble';

// docs/specs/009-elements/social-pieces.md "Arcade Machine" and workday-pieces.md "Reception Desk" (Work Tracker 615,
// 793): a bubble rises above its piece; where a Room Sign stands in that room it shows beside the piece, on the side
// with the most room, and below it only when neither side is clear.

// A Room Sign's design box (meeting-pieces.ts), and an Arcade Machine's and a Reception Desk's.
const sign = (x: number, y: number) => ({ x, y, width: 136, height: 72 });
const machine = { x: 100, y: 300, width: 64, height: 112 };
const desk = { x: 400, y: 300, width: 200, height: 112 };
// A sign hand-placed just above a piece, where its bubble rises.
const signAbove = (p: typeof machine) => sign(p.x + p.width / 2 - 68, p.y - 80);

describe('the bubble’s rooms', () => {
  it('rises centred over the piece, lifted off it, or stands level with its top beside it', () => {
    expect(bubbleAbove(machine)).toEqual({
      x: 132 - PIECE_BUBBLE.width / 2,
      y: 300 - PIECE_BUBBLE.lift - PIECE_BUBBLE.height,
      width: PIECE_BUBBLE.width,
      height: PIECE_BUBBLE.height,
    });
    expect(bubbleBeside(machine, 'right')).toMatchObject({ x: 164 + PIECE_BUBBLE.lift, y: 300 });
    expect(bubbleBeside(machine, 'left')).toMatchObject({
      x: 100 - PIECE_BUBBLE.lift - PIECE_BUBBLE.width,
      y: 300,
    });
    expect(
      boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 }),
    ).toBe(false);
  });
});

describe('bubbleSide', () => {
  it.each([
    ['an Arcade Machine', machine],
    ['a Reception Desk', desk],
  ])('moves the bubble of %s beside it under a hand-placed sign just above it', (_, piece) => {
    expect(bubbleSide(piece, signGrid([]))).toBe('above');
    // A sign beside the bubble's room, or well above it, leaves it rising.
    expect(bubbleSide(piece, signGrid([sign(piece.x + piece.width + 120, piece.y - 80)]))).toBe(
      'above',
    );
    expect(bubbleSide(piece, signGrid([sign(piece.x, piece.y - 300)]))).toBe('above');
    // Covered above: beside it, the right on a tie.
    expect(bubbleSide(piece, signGrid([signAbove(piece)]))).toBe('right');
  });

  it('takes the side with the most room, and below only when neither side is clear', () => {
    const above = signAbove(machine);
    // A sign on the right, near but clear of the bubble's room: the left has more room.
    const nearRight = sign(164 + PIECE_BUBBLE.lift + PIECE_BUBBLE.width + 10, 300);
    expect(bubbleSide(machine, signGrid([above, nearRight]))).toBe('left');
    // One in the right's room: the left.
    const onRight = sign(180, 310);
    expect(bubbleSide(machine, signGrid([above, onRight]))).toBe('left');
    // Both sides taken: below.
    const onLeft = sign(-60, 310);
    expect(bubbleSide(machine, signGrid([above, onRight, onLeft]))).toBe('below');
  });

  it('finds a sign across a cell edge and at negative coordinates', () => {
    const piece = { x: -40, y: 20, width: 64, height: 112 };
    expect(bubbleSide(piece, signGrid([sign(-80, -60)]))).toBe('right');
  });

  it('ranks a side only by the signs level with its room, and reads nothing on a board with none', () => {
    // In the same cells as the right's strip, but below it: the right keeps all its room.
    expect(bubbleSide(machine, signGrid([signAbove(machine), sign(300, 360)]))).toBe('right');
    expect(signsNear(signGrid([]), bubbleAbove(machine))).toEqual([]);
  });
});

describe('sideInView', () => {
  // A Reception Desk (200 px wide) at the front of a phone's 390 px view, your character centred under it.
  const phone = { x: 0, y: 0, width: 390, height: 844 };
  const wideDesk = { x: 95, y: 300, width: 200, height: 112 };
  it('shows a beside bubble below when it would leave a narrow view, either side', () => {
    expect(sideInView('right', bubbleBeside(wideDesk, 'right'), phone)).toBe('below');
    expect(sideInView('left', bubbleBeside(wideDesk, 'left'), phone)).toBe('below');
  });
  it('keeps a beside bubble that fits, and never moves one above or below', () => {
    const wide = { x: 0, y: 0, width: 1440, height: 900 };
    expect(sideInView('right', bubbleBeside(wideDesk, 'right'), wide)).toBe('right');
    expect(sideInView('left', bubbleBeside({ ...wideDesk, x: 400 }, 'left'), wide)).toBe('left');
    expect(sideInView('above', { x: -500, y: 0, width: 10, height: 10 }, phone)).toBe('above');
    expect(sideInView('below', { x: -500, y: 0, width: 10, height: 10 }, phone)).toBe('below');
  });
});

describe('signsNear', () => {
  it('reads only the signs in the cells the bubble touches, never the whole board', () => {
    // A board of 10,000 signs in a wide grid, one just above the machine.
    const far = Array.from({ length: 10_000 }, (_, i) =>
      sign(2000 + (i % 100) * 300, 2000 + Math.floor(i / 100) * 200),
    );
    const above = sign(64, 240);
    const grid = signGrid([...far, above]);
    expect(signsNear(grid, bubbleAbove(machine))).toEqual([above]);
    // Each bubble's check stays cheap on that board: 10,000 checks, each one covered above and choosing a side.
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i++) bubbleSide(machine, grid);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
