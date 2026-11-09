import { describe, expect, it } from 'vitest';
import { fenceLine, fenceParts, fencePostCentres, fenceRun, FENCE_POST_SPACING } from './fence';

// docs/specs/009-elements/fence.md
describe('fenceRun', () => {
  it('runs along the longer side, across when square', () => {
    expect(fenceRun({ width: 240, height: 24 })).toEqual({
      horizontal: true,
      length: 240,
      thickness: 24,
    });
    expect(fenceRun({ width: 24, height: 240 })).toEqual({
      horizontal: false,
      length: 240,
      thickness: 24,
    });
    expect(fenceRun({ width: 30, height: 30 }).horizontal).toBe(true);
  });
});

describe('fencePostCentres', () => {
  it('puts the end posts half the thickness in from each end', () => {
    const posts = fencePostCentres(240, 24);
    expect(posts[0]).toBe(12);
    expect(posts.at(-1)).toBe(228);
  });

  it('spaces the posts evenly, about FENCE_POST_SPACING apart', () => {
    const posts = fencePostCentres(240, 24);
    const gaps = posts.slice(1).map((p, i) => p - posts[i]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
    expect(Math.abs(gaps[0]! - FENCE_POST_SPACING)).toBeLessThan(FENCE_POST_SPACING / 2);
  });

  it('keeps one post on a run too short for two', () => {
    expect(fencePostCentres(20, 24)).toEqual([10]);
  });
});

describe('fenceParts', () => {
  it('runs the rails the full length so joined fences carry them on', () => {
    const rails = fenceParts(240, 24).filter((p) => p.role === 'rail');
    expect(rails).toHaveLength(2);
    for (const rail of rails) {
      expect(rail.x).toBe(0);
      expect(rail.width).toBe(240);
    }
  });

  it('turns the drawing onto a tall box', () => {
    const parts = fenceParts(24, 240);
    const rails = parts.filter((p) => p.role === 'rail');
    for (const rail of rails) {
      expect(rail.y).toBe(0);
      expect(rail.height).toBe(240);
    }
    const posts = parts.filter((p) => p.role === 'post');
    expect(posts[0]!.width).toBe(24);
  });

  it('puts the corner posts of two fences sharing a corner on the same spot', () => {
    const across = fenceParts(240, 24).filter((p) => p.role === 'post')[0]!;
    const down = fenceParts(24, 240).filter((p) => p.role === 'post')[0]!;
    expect(across.x + across.width / 2).toBe(down.x + down.width / 2);
    expect(across.y + across.height / 2).toBe(down.y + down.height / 2);
  });

  it('paints the rails before the posts', () => {
    const roles = fenceParts(240, 24).map((p) => p.role);
    expect(roles.lastIndexOf('rail')).toBeLessThan(roles.indexOf('post'));
  });
});

describe('fenceLine', () => {
  it('is the centre line along the run, end to end', () => {
    expect(fenceLine({ x: 100, y: 50, width: 240, height: 24 })).toEqual({
      a: { x: 100, y: 62 },
      b: { x: 340, y: 62 },
    });
    expect(fenceLine({ x: 100, y: 50, width: 24, height: 240 })).toEqual({
      a: { x: 112, y: 50 },
      b: { x: 112, y: 290 },
    });
  });

  it('turns with the element rotation, clockwise about the centre', () => {
    const { a, b } = fenceLine({ x: 0, y: 0, width: 200, height: 20, rotation: 90 });
    expect(a.x).toBeCloseTo(100, 6);
    expect(a.y).toBeCloseTo(-90, 6);
    expect(b.x).toBeCloseTo(100, 6);
    expect(b.y).toBeCloseTo(110, 6);
  });
});
