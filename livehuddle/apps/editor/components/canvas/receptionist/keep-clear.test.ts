// What the Receptionist's bubble keeps clear of (docs/specs/008-canvas/receptionist.md "His bubble", Work Tracker 1256).

import { describe, expect, it } from 'vitest';
import { clearTrim, clearNudge } from './keep-clear';

// A 300 px card over his head, 200 px tall, on a 1440 px canvas.
const card = { left: 200, right: 500, top: 100, bottom: 300 };
// The Welcome bubble with its Ring Bell, under the card's right half.
const bell = { left: 400, right: 500, top: 260, bottom: 284 };

describe('clearNudge', () => {
  it('keeps the nudge when the card covers nothing', () => {
    expect(clearNudge(card, 0, [], 16, 1424)).toBe(0);
    expect(clearNudge(card, 12, [{ left: 600, right: 700, top: 0, bottom: 900 }], 16, 1424)).toBe(
      12,
    );
    // Beside it, or above it: not covered.
    expect(clearNudge(card, 0, [{ ...bell, top: 310, bottom: 330 }], 16, 1424)).toBe(0);
  });

  it('moves the card to the nearer side of a control it covers', () => {
    // Left of the bell: its right edge 8 px short of the bell's left (-108); right of it: 308. The left is nearer.
    expect(clearNudge(card, 0, [bell], 16, 1424)).toBe(-108);
  });

  it('takes the other side when the nearer one runs off the canvas', () => {
    // Left would put the card's left edge at 92, short of the canvas's edge (116 here).
    expect(clearNudge(card, 0, [bell], 16 + 100, 1424)).toBe(308);
  });

  it('clears every control at once, or none fits', () => {
    const second = { left: 80, right: 140, top: 260, bottom: 284 };
    // Left of the bell runs onto the second control; right of the bell is clear of both.
    expect(clearNudge(card, 0, [bell, second], 16, 1424)).toBe(308);
    // A phone's canvas: 358 px wide, no side has the room.
    expect(clearNudge(card, 0, [bell], 16, 374)).toBeNull();
  });
});

describe('clearTrim', () => {
  it('is 0 off every control', () => {
    expect(clearTrim(card, [])).toBe(0);
    expect(clearTrim(card, [{ ...bell, left: 600, right: 700 }])).toBe(0);
  });

  it('is how far the card must shrink from its top to clear the control above his head', () => {
    // The bell's foot at 284: the card's top must come down to 292, 192 px.
    expect(clearTrim(card, [bell])).toBe(192);
    expect(clearTrim(card, [bell, { ...bell, bottom: 200 }])).toBe(192);
  });
});
