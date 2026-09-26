import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/diagram';
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
  } as Element;
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
