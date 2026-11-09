import { describe, expect, it } from 'vitest';
import {
  deleteLayer,
  freeDanglingEnds,
  freeEndsAttachedTo,
  removeElements,
  type Element,
  type Tab,
} from './index';

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

// Every delete path frees a kept arrow's ends through freeEndsAttachedTo: Delete and the eraser (removeElements),
// deleting a layer (deleteLayer), and a whiteboard erase. The same locked arrows keep the same free ends whichever way
// their boxes went.
describe('every delete path frees the same ends', () => {
  const on = (el: Element, layerId: string, locked = false): Element => ({
    ...el,
    layerId,
    ...(locked ? { locked: true } : {}),
  });
  const tab = {
    id: 't',
    name: 'T',
    layers: [
      { id: 'top', name: 'Top' },
      { id: 'base', name: 'Base' },
    ],
    elements: [
      on(before[0]!, 'top'),
      on(before[1]!, 'top'),
      on(before[2]!, 'base', true),
      on(before[3]!, 'base', true),
    ],
  } as unknown as Tab;

  it('removeElements and deleteLayer free the same ends where they were drawn', () => {
    const viaDelete = removeElements(tab.elements, new Set(['a', 'b']), (el) => el.locked === true);
    expect(viaDelete).toEqual(deleteLayer(tab, 'top').elements);
    expect(viaDelete[0]).toMatchObject({
      from: { kind: 'free', x: 100, y: 50 },
      to: { kind: 'free', x: 300, y: 50 },
    });
    expect(viaDelete[1]).toBe(tab.elements[3]);
  });

  it('removeElements frees an end hung off a removed arrow as freeEndsAttachedTo does', () => {
    const left = before.filter((el) => el.id !== 'ab');
    expect(removeElements(before, new Set(['ab']))).toEqual(
      freeEndsAttachedTo(left, (id) => id === 'ab', before),
    );
  });
});
