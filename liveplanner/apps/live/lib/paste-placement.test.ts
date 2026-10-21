import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { pasteTranslation } from './paste-placement';

const shape = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 100 }) as Element;

// A paste whose usual spot is out of view lands in the middle of the view
// (docs/specs/008-canvas/canvas-and-palette.md Clipboard): copied near the first
// slide and pasted while looking at the twelfth.
describe('pasteTranslation into the view', () => {
  const view = { x: 10_000, y: 0, width: 1200, height: 800 };

  it('keeps the usual offset when the copies land in view', () => {
    const inView = { x: -200, y: -200, width: 1200, height: 800 };
    expect(pasteTranslation([shape('s', 0, 0)], inView)).toEqual({
      dx: 24,
      dy: 24,
    });
  });

  it('centres the copies on the view when their spot is off-screen', () => {
    // The square's centre is (50, 50); the view's (10_600, 400).
    expect(pasteTranslation([shape('s', 0, 0)], view)).toEqual({
      dx: 10_550,
      dy: 350,
    });
  });

  it('centres a block by its whole box, landing on whole pixels', () => {
    const block = [shape('a', 0, 0), shape('b', 301, 0)];
    // Box 0..401 by 0..100: centre (200.5, 50).
    expect(pasteTranslation(block, view)).toEqual({
      dx: Math.round(10_600 - 200.5),
      dy: 350,
    });
  });

  it('counts an arrow between the copies in the box', () => {
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 1000, y: 0 },
    } as unknown as Element;
    expect(pasteTranslation([shape('s', 0, 0), arrow], view).dx).toBe(10_600 - 500);
  });

  it('leaves out an arrow end pinned to an element that was not copied', () => {
    // A box at x 6000 on slide 4, and an arrow from it to a box left behind: the far end does not move
    // with the paste, so it must not stretch the box to the origin.
    const box = shape('s', 6000, 0);
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 's', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'left-behind', anchor: 'w' },
    } as unknown as Element;
    const inView = { x: 5800, y: -200, width: 1200, height: 800 };
    expect(pasteTranslation([box, arrow], inView)).toEqual({
      dx: 24,
      dy: 24,
    });
  });

  it('leaves out an end resting on a copied arrow whose own end was left behind', () => {
    // Arrow A runs from the box to one left behind; arrow B ends on A. A is copied, but where B's end sits on it
    // resolves through the element left behind, so it must not stretch the box to the origin either.
    const box = shape('s', 6000, 0);
    const a = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 's', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'left-behind', anchor: 'w' },
    } as unknown as Element;
    const b = {
      id: 'b',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 's', anchor: 's' },
      to: { kind: 'on-arrow', arrowId: 'a', t: 0.5 },
    } as unknown as Element;
    const inView = { x: 5800, y: -200, width: 1200, height: 800 };
    expect(pasteTranslation([box, a, b], inView)).toEqual({
      dx: 24,
      dy: 24,
    });
  });

  it('keeps the offset with no view to measure', () => {
    expect(pasteTranslation([shape('s', 0, 0)], null).dx).toBe(24);
  });
});
