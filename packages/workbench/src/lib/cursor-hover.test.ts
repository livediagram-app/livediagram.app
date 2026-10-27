import { describe, expect, it } from 'vitest';
import { CURSOR_NEAR_PX, cursorsNearKey, pillWidth, pointerNearCursor } from './cursor-hover';

const origin = { x: 100, y: 50 };
const ada = { id: 'a', name: 'Ada', x: 200, y: 100 };

describe('pillWidth', () => {
  it('grows with the name, and with a picture', () => {
    expect(pillWidth('Ada')).toBeLessThan(pillWidth('Ada Lovelace'));
    expect(pillWidth('Ada', 'https://lh3.googleusercontent.com/a/x')).toBeGreaterThan(
      pillWidth('Ada'),
    );
  });
});

describe('pointerNearCursor', () => {
  // At zoom 1 the arrow's tip is at (300, 150) on screen.
  it('is near on the arrow, on the pill, and within the margin', () => {
    expect(pointerNearCursor(ada, { x: 300, y: 150 }, origin, 1)).toBe(true);
    expect(
      pointerNearCursor(ada, { x: 300 + 12 + pillWidth('Ada') - 1, y: 150 + 25 }, origin, 1),
    ).toBe(true);
    expect(
      pointerNearCursor(ada, { x: 300 - CURSOR_NEAR_PX, y: 150 - CURSOR_NEAR_PX }, origin, 1),
    ).toBe(true);
  });

  it('is not near beyond the margin on any side', () => {
    expect(pointerNearCursor(ada, { x: 300 - CURSOR_NEAR_PX - 1, y: 150 }, origin, 1)).toBe(false);
    expect(pointerNearCursor(ada, { x: 300, y: 150 - CURSOR_NEAR_PX - 1 }, origin, 1)).toBe(false);
    const right = 300 + 12 + pillWidth('Ada') + CURSOR_NEAR_PX;
    expect(pointerNearCursor(ada, { x: right + 1, y: 160 }, origin, 1)).toBe(false);
    expect(pointerNearCursor(ada, { x: 310, y: 150 + 30 + CURSOR_NEAR_PX + 1 }, origin, 1)).toBe(
      false,
    );
  });

  it('places the cursor by the zoom, but keeps its size on screen', () => {
    // At zoom 2 the tip is at (500, 250); the pill is no wider for the zoom.
    expect(pointerNearCursor(ada, { x: 500, y: 250 }, origin, 2)).toBe(true);
    expect(pointerNearCursor(ada, { x: 300, y: 150 }, origin, 2)).toBe(false);
    const right = 500 + 12 + pillWidth('Ada') + CURSOR_NEAR_PX;
    expect(pointerNearCursor(ada, { x: right + 1, y: 260 }, origin, 2)).toBe(false);
  });
});

describe('cursorsNearKey', () => {
  const bo = { id: 'b', name: 'Bo', x: 205, y: 105 };
  const far = { id: 'c', name: 'Cy', x: 900, y: 900 };

  it('names every cursor near the pointer, in order, and none without a pointer', () => {
    expect(cursorsNearKey([ada, bo, far], { x: 306, y: 156 }, origin, 1)).toBe('a\nb');
    expect(cursorsNearKey([far], { x: 306, y: 156 }, origin, 1)).toBe('');
    expect(cursorsNearKey([ada], null, origin, 1)).toBe('');
  });

  it('checks a crowded room well inside a frame', () => {
    const room = Array.from({ length: 500 }, (_, i) => ({
      id: `p${i}`,
      name: `Participant ${i}`,
      x: (i % 25) * 80,
      y: Math.floor(i / 25) * 40,
    }));
    const runs = 1000;
    // CPU time, not wall time, so a loaded machine cannot fail it.
    const start = process.cpuUsage();
    for (let i = 0; i < runs; i++) cursorsNearKey(room, { x: 400 + i, y: 300 }, origin, 1);
    const used = process.cpuUsage(start);
    // 500 cursors, checked 1,000 times: one check must cost well under a millisecond of a 16 ms frame.
    expect((used.user + used.system) / 1000 / runs).toBeLessThan(1);
  });
});
