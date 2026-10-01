import { describe, expect, it } from 'vitest';
import { createLandContext, LANDING_RULES } from './context';
import { boxOfPoints, commonFields, limitPoints, normaliseRotation } from './common';

// docs/specs/020-import-export/board-scene.md "Kinds": rotation, locks and links carry over.
describe('normaliseRotation', () => {
  it('keeps a turn in [0, 360), none for no turn', () => {
    expect(normaliseRotation(undefined)).toBeUndefined();
    expect(normaliseRotation(0)).toBeUndefined();
    expect(normaliseRotation(360)).toBeUndefined();
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(450)).toBe(90);
    expect(normaliseRotation(Number.NaN)).toBeUndefined();
  });
});

describe('commonFields', () => {
  it('keeps a web link, a lock, a rotation and a partial opacity', () => {
    const ctx = createLandContext();
    expect(
      commonFields(
        { key: 'a', rotationDeg: 30, locked: true, link: 'https://example.com' },
        ctx,
        0.5,
      ),
    ).toEqual({
      rotation: 30,
      locked: true,
      link: { kind: 'url', url: 'https://example.com' },
      opacity: 0.5,
    });
    expect(commonFields({ key: 'b' }, ctx, 1)).toEqual({});
    expect(ctx.notes()).toEqual([]);
  });

  it('keeps mail links and drops script links, saying so', () => {
    const ctx = createLandContext();
    expect(commonFields({ key: 'a', link: 'mailto:a@b.c' }, ctx, 1).link).toEqual({
      kind: 'url',
      url: 'mailto:a@b.c',
    });
    expect(commonFields({ key: 'b', link: 'javascript:alert(1)' }, ctx, 1).link).toBeUndefined();
    expect(commonFields({ key: 'c', link: 'data:text/html,x' }, ctx, 1).link).toBeUndefined();
    expect(ctx.notes()).toEqual([{ rule: LANDING_RULES.unsafeLink, count: 2, kind: 'degraded' }]);
  });
});

describe('boxOfPoints', () => {
  it('normalises points into a box at least 1 px each way', () => {
    expect(
      boxOfPoints([
        { x: 10, y: 20 },
        { x: 30, y: 20 },
      ]),
    ).toEqual({
      x: 10,
      y: 19.5,
      width: 20,
      height: 1,
      points: [
        { nx: 0, ny: 0.5 },
        { nx: 1, ny: 0.5 },
      ],
    });
  });
});

describe('limitPoints', () => {
  it('keeps a stroke under the limit as it is', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(limitPoints(pts, 10)).toBe(pts);
  });

  it('samples a longer one evenly, keeping both ends', () => {
    const pts = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 0 }));
    const out = limitPoints(pts, 11);
    expect(out).toHaveLength(11);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[10]).toEqual({ x: 100, y: 0 });
    expect(out[5]).toEqual({ x: 50, y: 0 });
  });
});
