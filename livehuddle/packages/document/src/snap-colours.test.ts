import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement, StickyElement, TextElement } from './index';
import { SNAP_COLOUR_FIELDS, snapTabColours, snappableCustomColours } from './snap-colours';

const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'focus-button',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
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
const sticky = (over: Partial<StickyElement> = {}): StickyElement => ({
  id: 'n',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});
// The retired elements (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4): a stored
// pen stroke, path and arrow keep every colour they stored.
const stroke = (over: Record<string, unknown> = {}): Element =>
  ({
    id: 'f',
    type: 'freehand',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    packedPoints: 'AQAAAAAA',
    closed: false,
    penWidth: 1.5,
    ...over,
  }) as Element;
const path = (over: Record<string, unknown> = {}): Element => ({
  id: 'p',
  type: 'path',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});
const arrow = (over: Record<string, unknown> = {}): Element => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
  ...over,
});

// docs/specs/023-draw-mode/draw-mode.md "Snap colours".
describe('snapTabColours', () => {
  it('snaps a shape outline to its stock colour by name', () => {
    const els: Element[] = [shape({ id: 's', strokeColor: '#1971C2' })];
    const out = snapTabColours(els);
    expect(out.elements).toEqual([shape({ id: 's', penColour: 'blue' })]);
    expect(out).toMatchObject({ colours: 1, changed: 1 });
  });

  it('snaps a neutral colour to the ink: no colour stored at all', () => {
    const out = snapTabColours([shape({ strokeColor: '#868e96', penColour: 'blue' })]);
    expect(out.elements[0]).toEqual(shape());
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
    const plain = shape({ id: 'plain' });
    const stock = shape({ id: 'stock', penColour: 'violet' });
    const els: Element[] = [
      plain,
      stock,
      shape({ id: 'a', strokeColor: '#E03131' }),
      shape({ id: 'b', strokeColor: '#e03131' }),
      text({ id: 'c', textColor: '#1971c2' }),
    ];
    const out = snapTabColours(els);
    expect(out.elements[0]).toBe(plain);
    expect(out.elements[1]).toBe(stock);
    expect(out).toMatchObject({ colours: 2, changed: 3 });
  });

  it('never touches fills, text on a fill, or a stored stroke, path or arrow', () => {
    const els: Element[] = [
      shape({ id: 'fill', fillColor: '#ffdf6b', textColor: '#e03131' }),
      sticky({ id: 'note', fillColor: '#fde68a', textColor: '#1971c2' }),
      shape({ id: 'clear', strokeColor: 'transparent' }),
      shape({ id: 'short', strokeColor: '#f00' }),
      stroke({ id: 'pen', strokeColor: '#e03131' }),
      stroke({ id: 'hl', pen: 'highlighter', strokeColor: '#ffd43b' }),
      path({ strokeColor: '#e03131' }),
      arrow({ strokeColor: '#2f9e44', textColor: '#6741d9', arrowheadColor: '#e03131' }),
    ];
    const out = snapTabColours(els);
    out.elements.forEach((el, i) => expect(el).toBe(els[i]));
    expect(out).toMatchObject({ colours: 0, changed: 0 });
    expect(snappableCustomColours(els)).toEqual([]);
  });

  it('keeps a snapped shape fill and label as they are', () => {
    const out = snapTabColours([
      shape({ strokeColor: '#e03131', fillColor: '#ffdf6b', textColor: '#123456' }),
    ]);
    expect(out.elements[0]).toEqual(
      shape({ penColour: 'red', fillColor: '#ffdf6b', textColor: '#123456' }),
    );
  });

  it('has one row per kind and field that carries a named colour', () => {
    expect(SNAP_COLOUR_FIELDS.map((r) => [r.hex, r.named])).toEqual([
      ['strokeColor', 'penColour'],
      ['textColor', 'penTextColour'],
      ['textColor', 'penTextColour'],
    ]);
    expect(SNAP_COLOUR_FIELDS.filter((r) => r.applies(text()))).toHaveLength(1);
    expect(SNAP_COLOUR_FIELDS.filter((r) => r.applies(shape()))).toHaveLength(2);
    expect(
      SNAP_COLOUR_FIELDS.filter((r) => r.applies(shape({ fillColor: '#ffdf6b' }))),
    ).toHaveLength(1);
    for (const el of [sticky(), stroke(), path(), arrow()])
      expect(SNAP_COLOUR_FIELDS.filter((r) => r.applies(el))).toHaveLength(0);
  });

  // docs/specs/023-draw-mode/blueprints/snap-colours.md: the named colours imports land on.
  it('snaps a text box and an unfilled shape’s label', () => {
    const out = snapTabColours([
      text({ textColor: '#1971C2', textSwatch: 2 }),
      shape({ id: 's2', strokeColor: '#2f9e44', textColor: '#c2255c' }),
      shape({ id: 's3', fillColor: 'transparent', textColor: '#868e96' }),
    ]);
    expect(out.elements).toEqual([
      text({ penTextColour: 'blue' }),
      shape({ id: 's2', penColour: 'green', penTextColour: 'pink' }),
      shape({ id: 's3', fillColor: 'transparent' }),
    ]);
    expect(out).toMatchObject({ changed: 3 });
  });

  it('lists a text box’s and a label’s custom colours among the snappable ones', () => {
    expect(
      snappableCustomColours([text({ textColor: '#0C8599' }), shape({ textColor: '#9c36b5' })]),
    ).toEqual(['#9c36b5', '#0c8599']);
  });
});

describe('snappableCustomColours', () => {
  it('lists the distinct lower-cased custom colours the snap would convert, newest first', () => {
    const els: Element[] = [
      shape({ id: '1', strokeColor: '#E03131' }),
      shape({ id: '2', strokeColor: '#1971c2' }),
      shape({ id: '3', strokeColor: '#e03131' }),
      shape({ id: '4', penColour: 'blue' }),
    ];
    expect(snappableCustomColours(els)).toEqual(['#e03131', '#1971c2']);
    expect(snappableCustomColours([])).toEqual([]);
  });
});
