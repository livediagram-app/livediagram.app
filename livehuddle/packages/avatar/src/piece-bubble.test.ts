import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  boxesOverlap,
  bubbleAbove,
  bubbleBelow,
  PIECE_BUBBLE,
  signGrid,
  signsNear,
} from './piece-bubble';

// docs/specs/009-elements/social-pieces.md "Arcade Machine" and workday-pieces.md "Reception Desk" (Work Tracker 615,
// 793): a bubble rises above its piece, and shows below it where a Room Sign stands in its room.

// A Room Sign's design box (meeting-pieces.ts), and an Arcade Machine's and a Reception Desk's.
const sign = (x: number, y: number) => ({ x, y, width: 136, height: 72 });
const machine = { x: 100, y: 300, width: 64, height: 112 };
const desk = { x: 400, y: 300, width: 200, height: 112 };

describe('bubbleAbove', () => {
  it('is the bubble’s room, centred over the piece and lifted off it', () => {
    expect(bubbleAbove(machine)).toEqual({
      x: 132 - PIECE_BUBBLE.width / 2,
      y: 300 - PIECE_BUBBLE.lift - PIECE_BUBBLE.height,
      width: PIECE_BUBBLE.width,
      height: PIECE_BUBBLE.height,
    });
    expect(
      boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 }),
    ).toBe(false);
  });
});

describe('bubbleBelow', () => {
  it.each([
    ['an Arcade Machine', machine],
    ['a Reception Desk', desk],
  ])('flips the bubble of %s under a hand-placed sign just above it', (_, piece) => {
    const above = sign(piece.x + piece.width / 2 - 68, piece.y - 80);
    expect(bubbleBelow(piece, signGrid([above]))).toBe(true);
    // A sign beside the bubble's room, or well above it, leaves it rising.
    expect(bubbleBelow(piece, signGrid([sign(piece.x + piece.width + 120, piece.y - 80)]))).toBe(
      false,
    );
    expect(bubbleBelow(piece, signGrid([sign(piece.x, piece.y - 300)]))).toBe(false);
    expect(bubbleBelow(piece, signGrid([]))).toBe(false);
  });

  it('finds a sign across a cell edge and at negative coordinates', () => {
    const piece = { x: -40, y: 20, width: 64, height: 112 };
    expect(bubbleBelow(piece, signGrid([sign(-60, -40)]))).toBe(true);
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
    // Each bubble's check stays cheap on that board: 10,000 checks.
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i++) bubbleBelow(machine, grid);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
