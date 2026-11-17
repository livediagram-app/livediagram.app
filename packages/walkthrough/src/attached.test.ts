// Hiding an element hides the arrows that hang off it (006-media/walkthroughs.md "Hide From Recording").
import { describe, expect, it } from 'vitest';
import { withAttachedArrows } from './attached';

const arrow = (id: string, from: unknown, to: unknown) => ({ id, type: 'arrow', from, to });
const pin = (elementId: string) => ({ kind: 'pinned', elementId });
const onArrow = (arrowId: string) => ({ kind: 'on-arrow', arrowId });

describe('withAttachedArrows', () => {
  const elements = [
    { id: 'a', type: 'shape' },
    { id: 'b', type: 'shape' },
    arrow('ab', pin('a'), pin('b')),
    arrow('off-ab', onArrow('ab'), { kind: 'free', x: 1, y: 2 }),
    arrow('loose', null, undefined),
    arrow('elsewhere', pin('c'), pin('d')),
    { id: 7, type: 'arrow' },
    null,
  ];

  it('adds every arrow pinned to a hidden element, and every arrow pinned onto those', () => {
    expect([...withAttachedArrows(elements, new Set(['a']))].sort()).toEqual(['a', 'ab', 'off-ab']);
  });

  it('hands back the same set when nothing is hidden, nothing is an arrow, or nothing hangs off it', () => {
    const none = new Set<string>();
    expect(withAttachedArrows(elements, none)).toBe(none);
    const shapes = new Set(['a']);
    expect(withAttachedArrows([{ id: 'a', type: 'shape' }], shapes)).toBe(shapes);
    const lone = new Set(['zzz']);
    expect(withAttachedArrows(elements, lone)).toBe(lone);
    // An arrow already hidden is not added twice.
    const both = new Set(['ab', 'off-ab']);
    expect(withAttachedArrows(elements, both)).toBe(both);
  });
});
