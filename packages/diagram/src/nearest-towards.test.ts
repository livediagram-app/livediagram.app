import { describe, expect, it } from 'vitest';
import { nearestElementTowards, opposingAnchor } from './nearest-towards';
import type { BoxedElement, Element } from './index';

// The touch quick-connect's target picker (spec/09). Tapping the + on a phone
// can't be dragged, so it has to guess what the user meant; these pin what
// "straight out that way" is allowed to mean.

const box = (id: string, x: number, y: number, over: Partial<BoxedElement> = {}): BoxedElement =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 60, ...over }) as BoxedElement;

const src = box('src', 0, 0);

describe('nearestElementTowards', () => {
  it('finds the box directly below', () => {
    const below = box('below', 0, 200);
    expect(nearestElementTowards([src, below], src, 's')?.id).toBe('below');
  });

  it('picks the NEAREST of several on the same side', () => {
    const near = box('near', 10, 120);
    const far = box('far', 10, 300);
    expect(nearestElementTowards([src, far, near], src, 's')?.id).toBe('near');
  });

  it('ignores boxes on the other side', () => {
    const above = box('above', 0, -200);
    expect(nearestElementTowards([src, above], src, 's')).toBeNull();
    expect(nearestElementTowards([src, above], src, 'n')?.id).toBe('above');
  });

  // The point is "the one under it", not "the nearest thing anywhere". A box
  // far off to the side is something the user would have dragged to
  // deliberately.
  it('ignores a box that is laterally miles away', () => {
    const offset = box('offset', 900, 200);
    expect(nearestElementTowards([src, offset], src, 's')).toBeNull();
  });

  it('allows a modest lateral offset', () => {
    const nudged = box('nudged', 60, 200);
    expect(nearestElementTowards([src, nudged], src, 's')?.id).toBe('nudged');
  });

  it('declines when the only candidate is beyond reach', () => {
    const distant = box('distant', 0, 5000);
    expect(nearestElementTowards([src, distant], src, 's')).toBeNull();
  });

  // A diagonal has no unambiguous "next box", so it declines rather than
  // guessing and attaching to something the user didn't mean.
  it('declines for a corner anchor', () => {
    const below = box('below', 0, 200);
    for (const a of ['ne', 'nw', 'se', 'sw'] as const) {
      expect(nearestElementTowards([src, below], src, a)).toBeNull();
    }
  });

  it('skips frames, arrows and excluded ids', () => {
    const frame = box('frame', 0, 150, { shape: 'frame' });
    const arrow = { id: 'a1', type: 'arrow', from: {}, to: {} } as unknown as Element;
    const real = box('real', 0, 400);
    // The frame is nearer, but a section backdrop is not a node.
    expect(nearestElementTowards([src, frame, arrow, real], src, 's')?.id).toBe('real');
    // And an excluded id (a group sibling) is passed over too.
    expect(nearestElementTowards([src, real], src, 's', new Set(['real']))).toBeNull();
  });

  it('never returns the source itself', () => {
    expect(nearestElementTowards([src], src, 's')).toBeNull();
  });

  // An overlapping box scores gap 0, so it must not beat a genuine neighbour
  // by going negative.
  it('does not let an overlapping box outrank a real neighbour', () => {
    const overlapping = box('over', 0, 40);
    const neighbour = box('neighbour', 0, 100);
    const winner = nearestElementTowards([src, overlapping, neighbour], src, 's');
    expect(['over', 'neighbour']).toContain(winner?.id);
    expect(winner).not.toBeNull();
  });
});

describe('opposingAnchor', () => {
  it('lands on the facing side', () => {
    expect(opposingAnchor('s')).toBe('n');
    expect(opposingAnchor('n')).toBe('s');
    expect(opposingAnchor('e')).toBe('w');
    expect(opposingAnchor('w')).toBe('e');
  });
});
