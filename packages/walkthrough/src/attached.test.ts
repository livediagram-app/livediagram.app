// Hiding an element hides what hangs off it (walkthroughs.md "Hide From Recording"): every arrow pinned to a hidden
// element, and every arrow pinned onto a hidden arrow, so no line is left pointing at nothing.
import { describe, expect, it } from 'vitest';
import { withAttachedArrows } from './attached';

const pinned = (elementId: string) => ({ kind: 'pinned', elementId });
const onArrow = (arrowId: string) => ({ kind: 'on-arrow', arrowId });
const free = { kind: 'free', x: 0, y: 0 };
const box = (id: string) => ({ id, type: 'shape' });
const arrow = (id: string, from: unknown, to: unknown) => ({ id, type: 'arrow', from, to });

describe('withAttachedArrows', () => {
  it('hands back the same set when nothing is hidden', () => {
    const ids = new Set<string>();
    expect(withAttachedArrows([arrow('a', pinned('x'), free)], ids)).toBe(ids);
  });

  it('hands back the same set when the tab holds no arrows', () => {
    const ids = new Set(['x']);
    expect(withAttachedArrows([box('x'), box('y'), null, { type: 'arrow' }], ids)).toBe(ids);
  });

  it('hands back the same set when no arrow hangs off a hidden element', () => {
    const ids = new Set(['x']);
    const elements = [
      box('x'),
      box('y'),
      arrow('a', pinned('y'), free),
      arrow('b', null, undefined),
    ];
    expect(withAttachedArrows(elements, ids)).toBe(ids);
  });

  it('adds an arrow pinned to a hidden element by either end', () => {
    const elements = [
      box('x'),
      box('y'),
      arrow('from-x', pinned('x'), pinned('y')),
      arrow('to-x', free, pinned('x')),
      arrow('y-only', pinned('y'), free),
    ];
    expect([...withAttachedArrows(elements, new Set(['x']))].sort()).toEqual([
      'from-x',
      'to-x',
      'x',
    ]);
  });

  it('follows arrows pinned onto hidden arrows, however the chain is ordered', () => {
    // c sits before b in the list, so it is only reached on a second pass.
    const elements = [
      box('x'),
      arrow('c', onArrow('b'), free),
      arrow('b', onArrow('a'), free),
      arrow('a', pinned('x'), free),
      arrow('d', free, free),
    ];
    expect([...withAttachedArrows(elements, new Set(['x']))].sort()).toEqual(['a', 'b', 'c', 'x']);
  });

  it('starts from a hidden arrow too', () => {
    const elements = [arrow('a', free, free), arrow('b', free, onArrow('a'))];
    expect([...withAttachedArrows(elements, new Set(['a']))].sort()).toEqual(['a', 'b']);
  });

  it('ignores ends whose ids are not strings or whose kind it does not know', () => {
    const elements = [
      box('x'),
      arrow('a', { kind: 'pinned', elementId: 7 }, { kind: 'on-arrow', arrowId: null }),
      arrow('b', { kind: 'other', elementId: 'x' }, {}),
      { id: 9, type: 'arrow', from: pinned('x') },
    ];
    const ids = new Set(['x']);
    expect(withAttachedArrows(elements, ids)).toBe(ids);
  });
});
