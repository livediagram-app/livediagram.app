import { describe, expect, it } from 'vitest';
import {
  adjustRecognised,
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

// docs/specs/023-whiteboard/whiteboard.md "Shape recognition": once shown, dragging on resizes.
describe('adjustRecognised', () => {
  const box = {
    kind: 'square' as const,
    bbox: { x: 0, y: 0, width: 100, height: 60 },
    confidence: 1,
  };

  it('moves the corner the pen rests near and keeps the opposite one', () => {
    const out = adjustRecognised(box, { x: 98, y: 58 }, { x: 148, y: 88 });
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 150, height: 90 });
  });

  it('flips cleanly past the fixed corner', () => {
    const out = adjustRecognised(box, { x: 100, y: 60 }, { x: -50, y: 60 });
    expect(out.bbox).toEqual({ x: -50, y: 0, width: 50, height: 60 });
  });

  it('keeps the far end of a line and moves the near one', () => {
    const line = {
      kind: 'line' as const,
      bbox: { x: 0, y: 0, width: 100, height: 0 },
      confidence: 1,
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
    };
    const out = adjustRecognised(line, { x: 101, y: 1 }, { x: 201, y: 51 });
    expect(out.from).toEqual({ x: 0, y: 0 });
    expect(out.to).toEqual({ x: 200, y: 50 });
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 200, height: 50 });
  });

  it('changes nothing while the pen has not moved', () => {
    expect(adjustRecognised(box, { x: 98, y: 58 }, { x: 98, y: 58 })).toEqual(box);
  });
});
