import { describe, expect, it } from 'vitest';
import {
  createFreehand,
  createPath,
  createShape,
  penColourHex,
  type Element,
} from '@livediagram/document';
import { DEFAULT_WHITEBOARD_PREFS } from './whiteboard-prefs';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  isPenStroke,
  strokesPenStyle,
  tabCustomColours,
  type PenPalette,
} from './quick-style-pen';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": pen strokes and the pen in
// hand take their colour and width from the panel: quick choices only, the eight stock colours (Ink
// first), adaptive, then the tab's custom colours when there are any; the pens' named widths.
const INK = '#1c1917';
const palette: PenPalette = { board: 'light', ink: INK, custom: [] };
const EIGHT = ['Ink', 'Blue', 'Red', 'Orange', 'Green', 'Teal', 'Violet', 'Pink'];
const stroke = (extra: object = {}) =>
  ({
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
      ],
      false,
    ),
    penWidth: 1.5,
    ...extra,
  }) as Element;
const [main, second] = DEFAULT_WHITEBOARD_PREFS.pens;

describe('isPenStroke', () => {
  it('takes a pen stroke, not a highlight, a sketch, a shape or a locked stroke', () => {
    expect(isPenStroke(stroke())).toBe(true);
    expect(isPenStroke(stroke({ pen: 'highlighter' }))).toBe(false);
    expect(isPenStroke(createFreehand([{ x: 0, y: 0 }], false))).toBe(false);
    expect(isPenStroke(createShape('square', 0, 0))).toBe(false);
    expect(isPenStroke(stroke({ locked: true }))).toBe(false);
  });
});

describe('strokesPenStyle', () => {
  it('names the strokes, offers the eight stock colours, and reads the shared values', () => {
    const style = strokesPenStyle(
      [stroke({ penColour: 'red' }), stroke({ penColour: 'red' })],
      palette,
    )!;
    expect(style.colour.options.map((o) => o.name)).toEqual(EIGHT);
    expect(style.colour.options[0]!.swatch).toBe(INK);
    expect(style.colour.options[2]!.swatch).toBe(penColourHex('red', 'light'));
    expect(style.colour.custom).toEqual([]);
    expect(style.subject).toMatchObject({ kind: 'strokes', name: '2 marker strokes' });
    expect(strokesPenStyle([stroke()], palette)!.subject.name).toBe('Marker stroke');
    expect(style.colour.value).toBe('red');
    expect(style.width.value).toBe('medium');
  });

  it('draws every swatch in its version for the board', () => {
    const dark = strokesPenStyle([stroke()], { ...palette, board: 'dark' })!;
    expect(dark.colour.options[1]!.swatch).toBe(penColourHex('blue', 'dark'));
  });

  it('offers the tab\u2019s custom colours as a second section', () => {
    const style = strokesPenStyle([stroke()], { ...palette, custom: ['#ff6b00', '#00a39b'] })!;
    expect(style.colour.custom.map((o) => [o.value, o.name, o.swatch])).toEqual([
      ['#ff6b00', 'Custom #ff6b00', '#ff6b00'],
      ['#00a39b', 'Custom #00a39b', '#00a39b'],
    ]);
  });

  it('reads an unpainted stroke as the ink, a custom one as its hex, and mixed values as none', () => {
    expect(strokesPenStyle([stroke()], palette)!.colour.value).toBe(INK_CHOICE);
    expect(strokesPenStyle([stroke({ strokeColor: '#FF6B00' })], palette)!.colour.value).toBe(
      '#ff6b00',
    );
    const mixed = strokesPenStyle(
      [stroke(), stroke({ penColour: 'blue', penWidth: 2.5 })],
      palette,
    )!;
    expect(mixed.colour.value).toBeNull();
    expect(mixed.width.value).toBeNull();
  });

  it('is absent without a pen stroke', () => {
    expect(strokesPenStyle([createShape('square', 0, 0)], palette)).toBeUndefined();
  });
});

describe('tabCustomColours', () => {
  it('lists the tab\u2019s custom stroke and shape colours, most recently drawn first, up to eight', () => {
    const shape = (strokeColor?: string) => ({ ...createShape('circle', 0, 0), strokeColor });
    const els = [
      stroke({ strokeColor: '#111111' }),
      shape('#222222'),
      stroke({ penColour: 'blue' }),
      stroke(),
      stroke({ strokeColor: '#111111' }),
      stroke({ strokeColor: '#FF6B00' }),
      { ...stroke({ strokeColor: '#333333' }), pen: 'highlighter' } as Element,
    ];
    expect(tabCustomColours(els)).toEqual(['#ff6b00', '#111111', '#222222']);
    const many = Array.from({ length: 12 }, (_, i) =>
      stroke({ strokeColor: `#0000${String(i).padStart(2, '0')}` }),
    );
    expect(tabCustomColours(many)).toHaveLength(8);
    expect(tabCustomColours(many)[0]).toBe('#000011');
    expect(tabCustomColours([stroke()])).toEqual([]);
  });
});

describe('tabCustomColours on imported boards', () => {
  // docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": the custom colours of the
  // tab's lines, arrows, paths and text too, so an imported board's own colours are one press away.
  it('reads arrows, paths and text boxes, never named stock colours or fills', () => {
    const els = [
      {
        ...createPath(
          [
            { x: 0, y: 0, mode: 'corner' },
            { x: 9, y: 9, mode: 'corner' },
          ],
          false,
        ),
        strokeColor: '#868e96',
      },
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 9, y: 9 },
        strokeColor: '#9c36b5',
      },
      { id: 't', type: 'text', x: 0, y: 0, width: 9, height: 9, textColor: '#0c8599' },
      { id: 'n', type: 'text', x: 0, y: 0, width: 9, height: 9, penTextColour: 'blue' },
      { ...createShape('square', 0, 0), fillColor: '#ffc9c9' },
    ] as Element[];
    expect(tabCustomColours(els)).toEqual(['#0c8599', '#9c36b5', '#868e96']);
  });
});

describe('heldPenStyle', () => {
  it('gives the main pen its one colour, the ink, so every pen has the same rows', () => {
    const style = heldPenStyle(main!, { ...palette, custom: ['#ff6b00'] });
    expect(style.colour).toEqual({
      value: INK_CHOICE,
      options: [{ value: INK_CHOICE, name: 'Ink', swatch: INK }],
      custom: [],
    });
    expect(style.width.value).toBe('medium');
    expect(style.subject).toEqual({ kind: 'pen', id: 'main', name: 'Marker 1' });
  });

  it('gives another pen the eight stock colours, the ink among them, and the tab\u2019s customs', () => {
    const style = heldPenStyle(second!, { ...palette, custom: ['#ff6b00'] });
    expect(style.colour.options.map((o) => o.name)).toEqual(EIGHT);
    expect(style.colour.custom.map((o) => o.value)).toEqual(['#ff6b00']);
    expect(style.colour.value).toBe('blue');
    // A marker holding the ink shows the ink as its choice.
    expect(heldPenStyle({ ...second!, colour: null }, palette).colour.value).toBe(INK_CHOICE);
  });
});

describe('applyPenStyle', () => {
  it('keeps a stock colour by name, a custom one as its hex, and clears both for the ink', () => {
    const named = applyPenStyle(stroke({ strokeColor: '#ff6b00' }), { colour: 'red' });
    expect(named).toMatchObject({ penColour: 'red' });
    expect('strokeColor' in named).toBe(false);
    const custom = applyPenStyle(named, { colour: '#00a39b' });
    expect(custom).toMatchObject({ strokeColor: '#00a39b' });
    expect('penColour' in custom).toBe(false);
    const ink = applyPenStyle(named, { colour: INK_CHOICE });
    expect('strokeColor' in ink || 'penColour' in ink).toBe(false);
  });

  it('sets the width in px from its name', () => {
    expect(applyPenStyle(stroke(), { width: 'bold' })).toMatchObject({ penWidth: 2.5 });
  });

  it('leaves anything but a pen stroke alone', () => {
    const shape = createShape('square', 0, 0);
    expect(applyPenStyle(shape, { width: 'bold' })).toBe(shape);
  });
});
