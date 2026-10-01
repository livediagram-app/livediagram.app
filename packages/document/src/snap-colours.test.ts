import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, FreehandElement, ShapeElement, TextElement } from './index';
import { SNAP_COLOUR_FIELDS, snapTabColours, snappableCustomColours } from './snap-colours';
import { encodeStrokePoints } from './stroke-points';

const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  packedPoints: encodeStrokePoints([
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ]),
  closed: false,
  penWidth: 1.5,
  ...over,
});
const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});
const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
  ...over,
});
const text = (over: Partial<TextElement> = {}): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label: 'hi',
  ...over,
});

// docs/specs/023-whiteboard/whiteboard.md "Snap colours".
describe('snapTabColours', () => {
  it('snaps a marker stroke, a shape outline and an arrow to their stock colours by name', () => {
    const els: Element[] = [
      stroke({ id: 'f', strokeColor: '#e03131' }),
      shape({ id: 's', strokeColor: '#1971C2' }),
      arrow({ id: 'a', strokeColor: '#2f9e44' }),
    ];
    const out = snapTabColours(els);
    expect(out.elements).toEqual([
      stroke({ id: 'f', penColour: 'red' }),
      shape({ id: 's', penColour: 'blue' }),
      arrow({ id: 'a', penColour: 'green' }),
    ]);
    expect(out).toMatchObject({ colours: 3, changed: 3 });
  });

  it('snaps a neutral colour to the ink: no colour stored at all', () => {
    const out = snapTabColours([stroke({ strokeColor: '#868e96', penColour: 'blue' })]);
    expect(out.elements[0]).toEqual(stroke());
    expect('penColour' in out.elements[0]!).toBe(false);
    expect('strokeColor' in out.elements[0]!).toBe(false);
  });

  it('replaces a named colour a custom one overrides, and drops the quick-swatch binding', () => {
    const out = snapTabColours([
      shape({ strokeColor: '#ff00ff', penColour: 'teal', strokeSwatch: 3 }),
    ]);
    expect(out.elements[0]).toEqual(shape({ penColour: 'pink' }));
  });

  it('returns untouched elements by identity and counts distinct colours and changed elements', () => {
    const plain = stroke({ id: 'plain' });
    const stock = shape({ id: 'stock', penColour: 'violet' });
    const els: Element[] = [
      plain,
      stock,
      stroke({ id: 'a', strokeColor: '#E03131' }),
      stroke({ id: 'b', strokeColor: '#e03131' }),
      arrow({ id: 'c', strokeColor: '#1971c2' }),
    ];
    const out = snapTabColours(els);
    expect(out.elements[0]).toBe(plain);
    expect(out.elements[1]).toBe(stock);
    expect(out).toMatchObject({ colours: 2, changed: 3 });
  });

  it('never touches highlighters, pencil strokes, fills, text colours, labels or arrow heads', () => {
    const els: Element[] = [
      stroke({ id: 'hl', pen: 'highlighter', strokeColor: '#ffd43b' }),
      stroke({ id: 'pencil', penWidth: undefined, strokeColor: '#e03131' }),
      shape({ id: 'fill', fillColor: '#ffdf6b', textColor: '#e03131' }),
      text({ id: 'text', textColor: '#1971c2' }),
      arrow({ id: 'head', arrowheadColor: '#e03131' }),
      shape({ id: 'clear', strokeColor: 'transparent' }),
      shape({ id: 'short', strokeColor: '#f00' }),
    ];
    const out = snapTabColours(els);
    out.elements.forEach((el, i) => expect(el).toBe(els[i]));
    expect(out).toMatchObject({ colours: 0, changed: 0 });
  });

  it('keeps a snapped shape fill and label as they are', () => {
    const out = snapTabColours([
      shape({ strokeColor: '#e03131', fillColor: '#ffdf6b', textColor: '#123456' }),
    ]);
    expect(out.elements[0]).toEqual(
      shape({ penColour: 'red', fillColor: '#ffdf6b', textColor: '#123456' }),
    );
  });

  it('protects locked elements and the ids it is told to skip (hidden or locked layers)', () => {
    const locked = stroke({ id: 'locked', locked: true, strokeColor: '#e03131' });
    const layered = stroke({ id: 'layered', strokeColor: '#e03131' });
    const out = snapTabColours([locked, layered], new Set(['layered']));
    expect(out.elements[0]).toBe(locked);
    expect(out.elements[1]).toBe(layered);
    expect(out.changed).toBe(0);
  });

  it('has one row per kind that carries a named colour', () => {
    expect(SNAP_COLOUR_FIELDS.map((r) => [r.hex, r.named])).toEqual([
      ['strokeColor', 'penColour'],
      ['strokeColor', 'penColour'],
      ['strokeColor', 'penColour'],
    ]);
    expect(SNAP_COLOUR_FIELDS.filter((r) => r.applies(stroke()))).toHaveLength(1);
    expect(SNAP_COLOUR_FIELDS.filter((r) => r.applies(text()))).toHaveLength(0);
  });
});

describe('snappableCustomColours', () => {
  it('lists the distinct lower-cased custom colours the snap would convert, newest first', () => {
    const els: Element[] = [
      stroke({ id: '1', strokeColor: '#E03131' }),
      shape({ id: '2', strokeColor: '#1971c2' }),
      stroke({ id: '3', strokeColor: '#e03131' }),
      stroke({ id: '4', penColour: 'blue' }),
      stroke({ id: '5', pen: 'highlighter', strokeColor: '#ffd43b' }),
      stroke({ id: '6', locked: true, strokeColor: '#00ff00' }),
      arrow({ id: '7', strokeColor: '#0000ff' }),
    ];
    expect(snappableCustomColours(els, new Set(['7']))).toEqual(['#e03131', '#1971c2']);
    expect(snappableCustomColours([])).toEqual([]);
  });
});
