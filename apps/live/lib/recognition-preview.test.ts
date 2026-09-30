import { describe, expect, it } from 'vitest';
import {
  RECOGNITION_PREVIEW_DWELL_MS,
  RECOGNITION_PREVIEW_STILL_PX,
  recogniseBoardStroke,
  stillSince,
} from './recognition-preview';

// docs/specs/023-whiteboard/whiteboard.md "Shape recognition": holding the pen still shows the shape
// that release would land.
const square = (): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: i * 10, y: 0 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 200, y: i * 10 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 200 - i * 10, y: 200 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 0, y: 200 - i * 10 });
  return pts;
};

describe('recogniseBoardStroke', () => {
  it('reads a square drawn as a stroke', () => {
    expect(recogniseBoardStroke({ points: square(), width: 1.5, streamline: 0.5 })?.kind).toBe(
      'square',
    );
  });

  it('reads a scribble as nothing', () => {
    const scribble = Array.from({ length: 30 }, (_, i) => ({ x: i * 7, y: (i * 37) % 23 }));
    expect(recogniseBoardStroke({ points: scribble, width: 1.5, streamline: 0.5 })).toBeNull();
  });
});

describe('stillSince', () => {
  const at = { x: 100, y: 100 };
  const still = (pts: { x: number; y: number }[], from: number, zoom: number) =>
    stillSince((i) => pts[i]!, from, pts.length, at, zoom);
  it('holds while every sample since stays within the still radius on screen', () => {
    expect(still([{ x: 0, y: 0 }, at, { x: 101, y: 101 }, { x: 99, y: 100 }], 1, 1)).toBe(true);
  });

  it('breaks once a sample leaves it, even if the pen comes back', () => {
    expect(still([{ x: 0, y: 0 }, at, { x: 120, y: 100 }, { x: 100, y: 100 }], 1, 1)).toBe(false);
  });

  it('measures on screen: the same wobble breaks it zoomed in', () => {
    const pts = [at, { x: 102, y: 100 }];
    expect(still(pts, 0, 1)).toBe(true);
    expect(still(pts, 0, 4)).toBe(false);
  });

  it('uses a delay long enough to be a pause, short enough to feel prompt', () => {
    expect(RECOGNITION_PREVIEW_DWELL_MS).toBeGreaterThanOrEqual(300);
    expect(RECOGNITION_PREVIEW_DWELL_MS).toBeLessThanOrEqual(700);
    expect(RECOGNITION_PREVIEW_STILL_PX).toBeGreaterThan(0);
  });
});
