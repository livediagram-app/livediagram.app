import { describe, expect, it } from 'vitest';
import { bowReciprocalEdges, RECIPROCAL_BOW } from './arrow-reciprocal';
import { createPinnedArrow, createShape } from './factories';
import type { ArrowElement, Element } from './index';

// docs/specs/008-canvas/layout-cleanup.md "Two-way edges bow apart".

const box = (id: string, x: number, y: number): Element => ({
  ...createShape('square', x, y),
  id,
  width: 100,
  height: 60,
});
const arrow = (id: string, from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id,
});

describe('two-way edges', () => {
  it('bow to opposite sides of the line between the boxes', () => {
    const out = bowReciprocalEdges([
      box('a', 0, 0),
      box('b', 0, 200),
      arrow('ab', 'a', 'b'),
      arrow('ba', 'b', 'a'),
    ]);
    const ab = out[2] as ArrowElement;
    const ba = out[3] as ArrowElement;
    expect(ab).toMatchObject({ arrowStyle: 'curved', curveOffset: { dx: -RECIPROCAL_BOW, dy: 0 } });
    expect(ba).toMatchObject({ arrowStyle: 'curved', curveOffset: { dx: RECIPROCAL_BOW } });
  });

  it('bows a labelled vertical pair far enough for the labels to sit side by side', () => {
    const out = bowReciprocalEdges([
      box('a', 0, 0),
      box('b', 0, 200),
      { ...arrow('ab', 'a', 'b'), label: 'share link created' },
      { ...arrow('ba', 'b', 'a'), label: 'link revoked' },
    ]);
    const bow = Math.abs((out[2] as ArrowElement).curveOffset!.dx);
    // 18 + 12 characters at 6.5px, halved, plus the gap.
    expect(bow).toBeCloseTo((18 + 12) * 3.25 + 12);
  });

  it('leaves one-way and already-curved arrows alone', () => {
    const one = [box('a', 0, 0), box('b', 0, 200), arrow('ab', 'a', 'b')];
    expect(bowReciprocalEdges(one)).toBe(one);
    const curved = [
      box('a', 0, 0),
      box('b', 0, 200),
      arrow('ab', 'a', 'b'),
      { ...arrow('ba', 'b', 'a'), arrowStyle: 'curved' as const },
    ];
    expect(bowReciprocalEdges(curved)).toBe(curved);
  });
});
