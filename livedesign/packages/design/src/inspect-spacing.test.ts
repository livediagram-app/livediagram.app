import { describe, expect, it } from 'vitest';
import { neighbourSpacing, pairSpacing, type InspectRect } from './inspect-spacing';

const r = (x: number, y: number, width: number, height: number): InspectRect => ({
  x,
  y,
  width,
  height,
});
const bySide = (lines: ReturnType<typeof neighbourSpacing>) =>
  Object.fromEntries(lines.map((l) => [l.side, l]));

describe('neighbourSpacing', () => {
  const screen = r(0, 0, 400, 800);

  it('measures to the screen edges when nothing is near', () => {
    const lines = bySide(neighbourSpacing(r(16, 100, 100, 40), [], screen));
    expect(lines.left).toMatchObject({ distance: 16, target: 'screen', axis: 'x', cross: 120 });
    expect(lines.right).toMatchObject({ distance: 284, target: 'screen' });
    expect(lines.top).toMatchObject({ distance: 100, target: 'screen', axis: 'y', cross: 66 });
    expect(lines.bottom).toMatchObject({ distance: 660, target: 'screen' });
  });

  it('takes the nearest facing edge of an overlapping neighbour on each side', () => {
    const target = r(100, 100, 100, 100);
    const others = [
      r(20, 120, 40, 40), // left, 40 away
      r(70, 150, 20, 100), // left, nearer (10), overlaps 150..200
      r(240, 0, 40, 400), // right, 40 away
      r(120, 20, 40, 30), // top, 50 away
      r(400, 400, 10, 10), // nowhere near: overlaps neither axis
    ];
    const lines = bySide(neighbourSpacing(target, others, null));
    expect(lines.left).toMatchObject({ distance: 10, target: 1, from: 90, to: 100, cross: 175 });
    expect(lines.right).toMatchObject({ distance: 40, target: 2 });
    expect(lines.top).toMatchObject({ distance: 50, target: 3, cross: 140 });
    expect(lines.bottom).toBeUndefined();
  });

  it('measures to the inner edges of what it sits within, before the screen', () => {
    const card = r(16, 200, 368, 200);
    const button = r(40, 340, 120, 40);
    const lines = bySide(neighbourSpacing(button, [card], screen));
    expect(lines.left).toMatchObject({ distance: 24, target: 0 });
    expect(lines.bottom).toMatchObject({ distance: 20, target: 0 });
    expect(lines.top).toMatchObject({ distance: 140, target: 0 });
    expect(lines.right).toMatchObject({ distance: 224, target: 0 });
  });

  it('skips itself and a touching neighbour, and the screen when it is outside it', () => {
    const target = r(100, 100, 50, 50);
    const lines = neighbourSpacing(
      target,
      [r(100, 100, 50, 50), r(150, 100, 20, 20)],
      r(0, 0, 120, 120),
    );
    expect(lines).toEqual([]);
  });
});

describe('pairSpacing', () => {
  it('measures the gap across and down between two apart', () => {
    const lines = pairSpacing(r(0, 0, 100, 50), r(150, 80, 50, 50));
    expect(lines).toEqual([
      expect.objectContaining({
        axis: 'x',
        from: 100,
        to: 150,
        distance: 50,
        cross: 25,
        side: 'right',
      }),
      expect.objectContaining({
        axis: 'y',
        from: 50,
        to: 80,
        distance: 30,
        cross: 50,
        side: 'bottom',
      }),
    ]);
  });

  it('measures the other way round, through the overlap', () => {
    const lines = pairSpacing(r(200, 200, 100, 100), r(0, 250, 150, 100));
    expect(lines).toEqual([
      expect.objectContaining({
        axis: 'x',
        from: 150,
        to: 200,
        distance: 50,
        cross: 275,
        side: 'left',
      }),
    ]);
    const up = pairSpacing(r(200, 200, 100, 100), r(250, 0, 100, 150));
    expect(up).toEqual([
      expect.objectContaining({
        axis: 'y',
        from: 150,
        to: 200,
        distance: 50,
        cross: 275,
        side: 'top',
      }),
    ]);
  });

  it('measures the four insets when one sits within the other, either way', () => {
    const outer = r(0, 0, 200, 200);
    const inner = r(20, 30, 100, 100);
    expect(pairSpacing(inner, outer).map((l) => l.distance)).toEqual([30, 80, 70, 20]);
    expect(pairSpacing(outer, inner).map((l) => l.distance)).toEqual([30, 80, 70, 20]);
  });

  it('measures nothing between two that overlap without one holding the other', () => {
    expect(pairSpacing(r(0, 0, 100, 100), r(50, 50, 100, 100))).toEqual([]);
  });
});
