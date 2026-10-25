import { describe, expect, it } from 'vitest';
import { computeReadingFrame, READING_TOP_ROOM } from './reading-frame';

describe('computeReadingFrame', () => {
  const rect = { width: 1000, height: 800 };
  it('fills the width up to 100%, with room above for the toolbar', () => {
    const page = { x: -397, y: -561.5, width: 794, height: 1123 };
    const { zoom, offset } = computeReadingFrame(rect, page, 0);
    expect(zoom).toBe(1);
    // The page's top lands READING_TOP_ROOM px down the canvas.
    const screenTop = rect.height / 2 + (page.y + offset.y - rect.height / 2) * zoom;
    expect(screenTop).toBeCloseTo(READING_TOP_ROOM);
  });
  it('centres a page that fits in the room below', () => {
    const page = { x: 0, y: 0, width: 2000, height: 400 };
    const { zoom, offset } = computeReadingFrame(rect, page, 0);
    expect(zoom).toBeCloseTo(0.468);
    const screenTop = rect.height / 2 + (page.y + offset.y - rect.height / 2) * zoom;
    expect(screenTop).toBeGreaterThan(READING_TOP_ROOM);
  });
});
