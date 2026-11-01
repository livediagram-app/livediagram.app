import { describe, expect, it } from 'vitest';
import { createFreehand, createShape, penColourHex, type Element } from '@livehuddle/document';
import { DEFAULT_WHITEBOARD_PREFS } from './whiteboard-prefs';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  isPenStroke,
  strokesPenStyle,
  type PenPalette,
} from './quick-style-pen';

// docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays": pen strokes and the pen in
// hand take their colour and width from the panel: quick choices only, the nine stock colours (Ink
// first), adaptive, custom colours a press deeper in the colour picker; the pens' named widths.
const INK = '#1c1917';
const palette: PenPalette = { board: 'light', ink: INK };
const STOCK = ['Ink', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Violet', 'Pink'];
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
  it('names the strokes, offers the nine stock colours, and reads the shared values', () => {
    const style = strokesPenStyle(
      [stroke({ penColour: 'red' }), stroke({ penColour: 'red' })],
      palette,
    )!;
    expect(style.colour.options.map((o) => o.name)).toEqual(STOCK);
    expect(style.colour.options[0]!.swatch).toBe(INK);
    expect(style.colour.options[1]!.swatch).toBe(penColourHex('red', 'light'));
    expect(style.subject).toMatchObject({ kind: 'strokes', name: '2 marker strokes' });
    expect(strokesPenStyle([stroke()], palette)!.subject.name).toBe('Marker stroke');
    expect(style.colour.value).toBe('red');
    expect(style.width.value).toBe('medium');
  });

  it('draws every swatch in its version for the board', () => {
    const dark = strokesPenStyle([stroke()], { ...palette, board: 'dark' })!;
    expect(dark.colour.options[6]!.swatch).toBe(penColourHex('blue', 'dark'));
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

describe('heldPenStyle', () => {
  it('gives the main pen its one colour, the ink, so every pen has the same rows', () => {
    const style = heldPenStyle(main!, palette);
    expect(style.colour).toEqual({
      value: INK_CHOICE,
      options: [{ value: INK_CHOICE, name: 'Ink', swatch: INK }],
    });
    expect(style.width.value).toBe('medium');
    expect(style.subject).toEqual({ kind: 'pen', id: 'main', name: 'Marker 1' });
  });

  it('gives another pen the nine stock colours, the ink among them', () => {
    const style = heldPenStyle(second!, palette);
    expect(style.colour.options.map((o) => o.name)).toEqual(STOCK);
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
    expect(applyPenStyle(stroke(), { width: 'thick' })).toMatchObject({ penWidth: 4 });
    expect(applyPenStyle(stroke(), { width: 'heavy' })).toMatchObject({ penWidth: 6 });
    expect(applyPenStyle(stroke(), { width: 'broad' })).toMatchObject({ penWidth: 9 });
  });

  it('leaves anything but a pen stroke alone', () => {
    const shape = createShape('square', 0, 0);
    expect(applyPenStyle(shape, { width: 'bold' })).toBe(shape);
  });
});
