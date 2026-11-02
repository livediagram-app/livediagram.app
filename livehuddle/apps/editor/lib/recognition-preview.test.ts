import { describe, expect, it } from 'vitest';
import {
  adjustRecognised,
  RECOGNITION_PREVIEW_DWELL_MS,
  RECOGNITION_PREVIEW_STILL_PX,
  recogniseBoardStroke,
  shiftRatio,
  stillSince,
} from './recognition-preview';

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": holding the pen still shows the shape
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

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": once shown, dragging on resizes.
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

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Shift while reshaping makes it perfect.
describe('adjustRecognised, held to a ratio (Shift)', () => {
  const box = {
    kind: 'circle' as const,
    bbox: { x: 0, y: 0, width: 100, height: 60 },
    confidence: 1,
  };
  const line = {
    kind: 'line' as const,
    bbox: { x: 0, y: 0, width: 100, height: 0 },
    confidence: 1,
    from: { x: 0, y: 0 },
    to: { x: 100, y: 0 },
  };

  it('keeps a box as wide as it is tall, the corner following the larger distance', () => {
    const out = adjustRecognised(box, { x: 98, y: 58 }, { x: 148, y: 68 }, 1);
    expect(out).toEqual({ ...box, bbox: { x: 0, y: 0, width: 150, height: 150 } });
  });

  it('follows the taller side when the pen has moved further down than across', () => {
    const out = adjustRecognised(box, { x: 98, y: 58 }, { x: 88, y: 158 }, 1);
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 160, height: 160 });
  });

  it('grows from the fixed corner on whichever side the pen is', () => {
    const out = adjustRecognised(box, { x: 2, y: 2 }, { x: -8, y: 2 }, 1);
    expect(out.bbox).toEqual({ x: -10, y: -50, width: 110, height: 110 });
  });

  it('still flips past the fixed corner, perfect on the other side', () => {
    const out = adjustRecognised(box, { x: 100, y: 60 }, { x: -50, y: 60 }, 1);
    expect(out.bbox).toEqual({ x: -60, y: 0, width: 60, height: 60 });
  });

  it('keeps the side it had when the dragged corner lines up with the fixed one', () => {
    const out = adjustRecognised(box, { x: 100, y: 60 }, { x: 0, y: 60 }, 1);
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 60, height: 60 });
  });

  it('makes the box perfect even where the pen has not moved', () => {
    const out = adjustRecognised(box, { x: 98, y: 58 }, { x: 98, y: 58 }, 1);
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('keeps every boxed kind', () => {
    for (const kind of ['square', 'diamond', 'triangle', 'star', 'circle'] as const) {
      const out = adjustRecognised({ ...box, kind }, { x: 98, y: 58 }, { x: 98, y: 58 }, 1);
      expect(out.kind).toBe(kind);
      expect(out.bbox.width).toBe(out.bbox.height);
    }
  });

  it('snaps a line to horizontal about its fixed end', () => {
    const out = adjustRecognised(line, { x: 101, y: 1 }, { x: 181, y: 71 }, 1);
    expect(out.from).toEqual({ x: 0, y: 0 });
    expect(out.to).toEqual({ x: 180, y: 0 });
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 180, height: 0 });
  });

  it('snaps a line to the diagonal, the end nearest the pen along it', () => {
    const out = adjustRecognised(line, { x: 101, y: 1 }, { x: 161, y: 141 }, 1);
    expect(out.from).toEqual({ x: 0, y: 0 });
    expect(out.to).toEqual({ x: 150, y: 150 });
  });

  it('snaps the near end of a line to vertical, keeping the far one', () => {
    const out = adjustRecognised(line, { x: -1, y: 0 }, { x: 95, y: -120 }, 1);
    expect(out.from).toEqual({ x: 100, y: -120 });
    expect(out.to).toEqual({ x: 100, y: 0 });
    expect(out.bbox).toEqual({ x: 100, y: -120, width: 0, height: 120 });
  });

  it('snaps in every one of the eight directions', () => {
    const fixed = { x: 0, y: 0 };
    const seg = { ...line, from: fixed, to: { x: 10, y: 0 } };
    for (let step = 0; step < 8; step++) {
      // 10 degrees off each 45 degree step, 100 px out.
      const a = ((step * 45 + 10) * Math.PI) / 180;
      const out = adjustRecognised(
        seg,
        { x: 10, y: 0 },
        { x: 100 * Math.cos(a), y: 100 * Math.sin(a) },
        1,
      );
      const angle = (Math.atan2(out.to!.y, out.to!.x) * 180) / Math.PI;
      expect((angle + 360) % 360).toBeCloseTo(step * 45, 6);
    }
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": a rectangle snaps to the nearest of
// 1:1, 5:3 and 3:5 by the logarithm of width over height; every other box keeps 1:1.
describe('shiftRatio', () => {
  const of = (
    kind: 'square' | 'circle' | 'diamond' | 'triangle' | 'star' | 'line',
    w: number,
    h: number,
  ) => shiftRatio({ kind, bbox: { x: 0, y: 0, width: w, height: h }, confidence: 1 });

  it('makes a drawn square a perfect square', () => {
    expect(of('square', 100, 98)).toBe(1);
    expect(of('square', 98, 100)).toBe(1);
  });

  it('makes a drawn rectangle a clean 5:3 or 3:5', () => {
    expect(of('square', 100, 60)).toBe(5 / 3);
    expect(of('square', 60, 100)).toBe(3 / 5);
    expect(of('square', 300, 100)).toBe(5 / 3);
    expect(of('square', 100, 300)).toBe(3 / 5);
  });

  it('splits 1:1 from 5:3 at their geometric mean', () => {
    expect(of('square', 128, 100)).toBe(1);
    expect(of('square', 130, 100)).toBe(5 / 3);
    expect(of('square', 100, 128)).toBe(1);
    expect(of('square', 100, 130)).toBe(3 / 5);
  });

  it('reads a flat rectangle as landscape, a thin one as portrait, and a dot as square', () => {
    expect(of('square', 100, 0)).toBe(5 / 3);
    expect(of('square', 0, 100)).toBe(3 / 5);
    expect(of('square', 0, 0)).toBe(1);
  });

  it('keeps every other shape 1:1, however it was drawn', () => {
    for (const kind of ['circle', 'diamond', 'triangle', 'star', 'line'] as const) {
      expect(of(kind, 100, 60)).toBe(1);
    }
  });
});

describe('adjustRecognised, held to 5:3', () => {
  const rect = {
    kind: 'square' as const,
    bbox: { x: 0, y: 0, width: 100, height: 60 },
    confidence: 1,
  };

  it('follows the width when the pen has gone further across than the ratio', () => {
    const out = adjustRecognised(rect, { x: 98, y: 58 }, { x: 148, y: 68 }, 5 / 3);
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 150, height: 90 });
  });

  it('follows the height when the pen has gone further down than the ratio', () => {
    const out = adjustRecognised(rect, { x: 98, y: 58 }, { x: 98, y: 148 }, 5 / 3);
    expect(out.bbox).toEqual({ x: 0, y: 0, width: 250, height: 150 });
  });

  it('keeps the ratio flipped past the fixed corner', () => {
    const out = adjustRecognised(rect, { x: 100, y: 60 }, { x: -50, y: 60 }, 5 / 3);
    expect(out.bbox).toEqual({ x: -100, y: 0, width: 100, height: 60 });
  });
});
