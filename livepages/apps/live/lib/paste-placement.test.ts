import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livepages/document';
import { landPastedCopies, pasteTranslation } from './paste-placement';

// Where a paste lands (docs/specs/021-event-storming/event-storming.md "Always on a lane"): at the pointer when it
// is over the canvas, staggered on the original along its lane otherwise; the
// ordinary diagonal offset everywhere else.

function workshop(id: string, x: number, y: number): Element {
  return {
    id,
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    esKind: 'domain-event',
    fillColor: '#fdba74',
    fixedSize: true,
  };
}

const shape = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 100 }) as Element;

const esBoard = (elements: Element[] = []) =>
  ({ id: 't', name: 'T', kind: 'event-storming', elements }) as Tab;
const plainBoard = { id: 't', name: 'T', elements: [] } as unknown as Tab;

describe('pasteTranslation', () => {
  it('keeps the diagonal offset off an event-storming board, pointer or not', () => {
    expect(pasteTranslation([workshop('a', 0, 0)], plainBoard, { x: 900, y: 900 })).toEqual({
      dx: 24,
      dy: 24,
      atPointer: false,
    });
  });

  it('keeps the diagonal offset for a paste with no workshop note in it', () => {
    expect(pasteTranslation([shape('s', 0, 0)], esBoard(), null)).toEqual({
      dx: 24,
      dy: 24,
      atPointer: false,
    });
  });

  it('staggers along the lane when the pointer is not over the canvas', () => {
    expect(pasteTranslation([workshop('a', 0, 240)], esBoard(), null)).toEqual({
      dx: 24,
      dy: 0,
      atPointer: false,
    });
  });

  it('centres one note on the pointer', () => {
    expect(pasteTranslation([workshop('a', 0, 240)], esBoard(), { x: 1000, y: 700 })).toEqual({
      dx: 900,
      dy: 360,
      atPointer: true,
    });
  });

  it('centres a block on the pointer by its bounding box', () => {
    const block = [workshop('a', 0, 0), workshop('b', 216, 240)];
    // Box 0..416 x 0..440, centre (208, 220).
    expect(pasteTranslation(block, esBoard(), { x: 1208, y: 1220 })).toMatchObject({
      dx: 1000,
      dy: 1000,
      atPointer: true,
    });
  });
});

describe('landPastedCopies', () => {
  it('puts a lone note pasted onto an occupied spot in the nearest free slot', () => {
    const els = [workshop('down', 0, 0), workshop('copy', 40, 10)];
    const out = landPastedCopies(els, new Set(['copy']), true);
    expect(out.find((e) => e.id === 'copy')).toMatchObject({ x: 216, y: 0 });
  });

  it('lets a staggered copy overlap its original, on the lane', () => {
    const els = [workshop('down', 0, 0), workshop('copy', 24, 0)];
    expect(landPastedCopies(els, new Set(['copy']), false)).toBe(els);
  });

  it('keeps a block together and gives each row its own lane', () => {
    const els = [workshop('a', 1000, 1010), workshop('b', 1216, 1250), shape('s', 1100, 1333)];
    const out = landPastedCopies(els, new Set(['a', 'b', 's']), true);
    expect(out.find((e) => e.id === 'a')).toMatchObject({ x: 1000, y: 960 });
    expect(out.find((e) => e.id === 'b')).toMatchObject({ x: 1216, y: 1200 });
    expect(out.find((e) => e.id === 's')).toMatchObject({ x: 1100, y: 1333 });
  });
});

// A paste whose usual spot is out of view lands in the middle of the view
// (docs/specs/008-canvas/canvas-and-palette.md Clipboard): copied near the first
// slide and pasted while looking at the twelfth.
describe('pasteTranslation into the view', () => {
  const view = { x: 10_000, y: 0, width: 1200, height: 800 };

  it('keeps the usual offset when the copies land in view', () => {
    const inView = { x: -200, y: -200, width: 1200, height: 800 };
    expect(pasteTranslation([shape('s', 0, 0)], plainBoard, null, inView)).toEqual({
      dx: 24,
      dy: 24,
      atPointer: false,
    });
  });

  it('centres the copies on the view when their spot is off-screen', () => {
    // The square's centre is (50, 50); the view's (10_600, 400).
    expect(pasteTranslation([shape('s', 0, 0)], plainBoard, null, view)).toEqual({
      dx: 10_550,
      dy: 350,
      atPointer: false,
    });
  });

  it('centres a block by its whole box, landing on whole pixels', () => {
    const block = [shape('a', 0, 0), shape('b', 301, 0)];
    // Box 0..401 by 0..100: centre (200.5, 50).
    expect(pasteTranslation(block, plainBoard, null, view)).toEqual({
      dx: Math.round(10_600 - 200.5),
      dy: 350,
      atPointer: false,
    });
  });

  it('counts an arrow between the copies in the box', () => {
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 1000, y: 0 },
    } as unknown as Element;
    expect(pasteTranslation([shape('s', 0, 0), arrow], plainBoard, null, view).dx).toBe(
      10_600 - 500,
    );
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
    expect(pasteTranslation([box, arrow], plainBoard, null, inView)).toEqual({
      dx: 24,
      dy: 24,
      atPointer: false,
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
    expect(pasteTranslation([box, a, b], plainBoard, null, inView)).toEqual({
      dx: 24,
      dy: 24,
      atPointer: false,
    });
  });

  it('keeps the offset with no view to measure', () => {
    expect(pasteTranslation([shape('s', 0, 0)], plainBoard, null, null).dx).toBe(24);
  });

  it('staggers an event-storming note off-screen into the view, not at the pointer', () => {
    expect(pasteTranslation([workshop('a', 0, 240)], esBoard(), null, view)).toEqual({
      dx: 10_500,
      dy: 60,
      atPointer: false,
    });
  });

  it('still lands an event-storming note at the pointer when there is one', () => {
    expect(
      pasteTranslation([workshop('a', 0, 240)], esBoard(), { x: 10_100, y: 100 }, view),
    ).toMatchObject({ atPointer: true });
  });
});
