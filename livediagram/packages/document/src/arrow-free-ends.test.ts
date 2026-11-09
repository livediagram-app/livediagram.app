import { describe, expect, it } from 'vitest';
import { freeDanglingEnds, freeEndsAttachedTo, type Element } from './index';

// docs/specs/008-canvas/canvas-and-palette.md "Locking arrows": an arrow that outlives what it was attached to keeps
// that end where it was drawn.

const box = (id: string, x: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 100,
  height: 100,
});

const before: Element[] = [
  box('a', 0),
  box('b', 300),
  {
    id: 'ab',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
  },
  {
    id: 'hung',
    type: 'arrow',
    from: { kind: 'on-arrow', arrowId: 'ab', t: 0.5 },
    to: { kind: 'free', x: 200, y: 300 },
  },
];

describe('freeEndsAttachedTo', () => {
  it('frees only the ends attached to what went, at the point they were drawn', () => {
    const left = before.filter((el) => el.id !== 'b');
    const out = freeEndsAttachedTo(left, (id) => id === 'b', before);
    expect(out[1]).toMatchObject({
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'free', x: 300, y: 50 },
    });
    expect(out[2]).toBe(left[2]);
  });

  it('frees an end hung off an arrow that went, and hands back the same array when nothing changes', () => {
    const left = before.filter((el) => el.id !== 'ab');
    const out = freeEndsAttachedTo(left, (id) => id === 'ab', before);
    expect(out[2]).toMatchObject({ from: { kind: 'free', x: 200, y: 50 } });
    expect(freeEndsAttachedTo(before, () => false, before)).toBe(before);
  });
});

describe('freeDanglingEnds', () => {
  it('frees every end naming an element missing from the list', () => {
    const left = before.filter((el) => el.id !== 'a');
    const out = freeDanglingEnds(left, before);
    expect(out[1]).toMatchObject({ from: { kind: 'free', x: 100, y: 50 } });
    expect(freeDanglingEnds(before, before)).toBe(before);
  });
});
