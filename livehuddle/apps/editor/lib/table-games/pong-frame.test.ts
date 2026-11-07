import { describe, expect, it } from 'vitest';
import { PING_PONG_TOP, PING_PONG_TOP_SIDE } from '@livehuddle/document';
import { framePointerAxis, paddleKey, paddleLength, pongFrame } from './pong-frame';

// docs/specs/009-elements/furniture-facing.md "Live faces", social-pieces.md "Controls": the game on a turned table.

describe('pongFrame', () => {
  it('lays the play area along the table facing down, the left seat’s end on the left', () => {
    const f = pongFrame('n');
    expect(f.across).toBe('y');
    expect(f.at(0, 0)).toEqual({ x: PING_PONG_TOP.x, y: PING_PONG_TOP.y });
    expect(f.at(1, 1)).toEqual({
      x: PING_PONG_TOP.x + PING_PONG_TOP.w,
      y: PING_PONG_TOP.y + PING_PONG_TOP.h,
    });
  });

  it('plays from behind as the front with the ends swapped', () => {
    const f = pongFrame('s');
    expect(f.across).toBe('y');
    expect(f.at(0, 0).x).toBe(PING_PONG_TOP.x + PING_PONG_TOP.w);
    expect(f.at(1, 0).x).toBe(PING_PONG_TOP.x);
    expect(f.at(0, 0.5).y).toBe(PING_PONG_TOP.y + PING_PONG_TOP.h / 2);
  });

  it('on its side runs the table down the canvas, the left seat’s end at the top, the paddles across', () => {
    for (const facing of ['e', 'w'] as const) {
      const f = pongFrame(facing);
      expect(f.across, facing).toBe('x');
      expect(f.grid.width).toBeLessThan(f.grid.height);
      expect(f.at(0, 0).y).toBe(PING_PONG_TOP_SIDE.y);
      expect(f.at(1, 0).y).toBe(PING_PONG_TOP_SIDE.y + PING_PONG_TOP_SIDE.h);
      // Across runs left to right on screen at either side.
      expect(f.at(0, 1).x).toBeGreaterThan(f.at(0, 0).x);
      expect(f.table.x + f.table.w).toBeLessThanOrEqual(f.grid.width);
    }
    // Facing right is the side drawing mirrored, so its table top is too.
    const e = pongFrame('e').table;
    const w = pongFrame('w').table;
    expect(w.x).toBe(pongFrame('w').grid.width - e.x - e.w);
  });

  it('draws a paddle as long as the model’s across the table', () => {
    expect(paddleLength(pongFrame('n'), 0.25)).toBe(PING_PONG_TOP.h / 2);
    expect(paddleLength(pongFrame('e'), 0.25)).toBe(PING_PONG_TOP_SIDE.w / 2);
  });
});

describe('framePointerAxis', () => {
  it('reads across the table on its side, from the pointer’s x', () => {
    const f = pongFrame('e');
    const box = { left: 100, top: 0, width: f.grid.width * 2, height: f.grid.height * 2 };
    const left = 100 + f.table.x * 2;
    expect(framePointerAxis(f, { clientX: left, clientY: 0 }, box)).toBeCloseTo(0);
    expect(framePointerAxis(f, { clientX: left + f.table.w, clientY: 999 }, box)).toBeCloseTo(0.5);
    expect(framePointerAxis(f, { clientX: left, clientY: 0 }, { ...box, width: 0 })).toBe(0.5);
  });
});

describe('paddleKey', () => {
  it('takes W/S and Up/Down when the paddles move down the canvas', () => {
    for (const key of ['w', 'W', 'ArrowUp']) expect(paddleKey({ key }, 'y'), key).toBe(-1);
    for (const key of ['s', 'S', 'ArrowDown']) expect(paddleKey({ key }, 'y'), key).toBe(1);
    for (const key of ['a', 'd', 'ArrowLeft', 'ArrowRight', 'x'])
      expect(paddleKey({ key }, 'y'), key).toBe(0);
  });

  it('takes A/D and Left/Right when they move across it, and nothing held with a modifier', () => {
    for (const key of ['a', 'A', 'ArrowLeft']) expect(paddleKey({ key }, 'x'), key).toBe(-1);
    for (const key of ['d', 'D', 'ArrowRight']) expect(paddleKey({ key }, 'x'), key).toBe(1);
    for (const key of ['w', 's', 'ArrowUp', 'ArrowDown'])
      expect(paddleKey({ key }, 'x'), key).toBe(0);
    for (const mod of ['metaKey', 'ctrlKey', 'altKey'])
      expect(paddleKey({ key: 'a', [mod]: true }, 'x'), mod).toBe(0);
  });
});
