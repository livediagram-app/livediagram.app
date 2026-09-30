import { describe, expect, it } from 'vitest';
import { createFreehand, createShape, type Element } from '@livediagram/document';
import { DEFAULT_WHITEBOARD_PREFS } from './whiteboard-prefs';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  isPenStroke,
  strokesPenStyle,
} from './quick-style-pen';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": pen strokes and the pen in
// hand take their colour and width from the panel, in the pens' own palette and widths.
const INK = '#1c1917';
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
  it('names the strokes, offers the ink and every pen colour, and reads the shared values', () => {
    const style = strokesPenStyle(
      [stroke({ strokeColor: '#e5484d' }), stroke({ strokeColor: '#e5484d' })],
      INK,
    )!;
    expect(style.colour!.options.map((o) => o.name)).toEqual([
      'Ink',
      'Blue',
      'Red',
      'Orange',
      'Green',
      'Teal',
      'Violet',
      'Pink',
    ]);
    expect(style.colour!.options[0]!.swatch).toBe(INK);
    expect(style.subject).toMatchObject({ kind: 'strokes', name: '2 pen strokes' });
    expect(style.colour!.value).toBe('#e5484d');
    expect(style.width.value).toBe('medium');
  });

  it('reads an unpainted stroke as the ink, and mixed values as none', () => {
    expect(strokesPenStyle([stroke()], INK)!.colour!.value).toBe(INK_CHOICE);
    const mixed = strokesPenStyle(
      [stroke(), stroke({ strokeColor: '#1d7afc', penWidth: 2.5 })],
      INK,
    )!;
    expect(mixed.colour!.value).toBeNull();
    expect(mixed.width.value).toBeNull();
  });

  it('is absent without a pen stroke', () => {
    expect(strokesPenStyle([createShape('square', 0, 0)], INK)).toBeUndefined();
  });
});

describe('heldPenStyle', () => {
  it('gives the main pen its one colour, the ink, so every pen has the same rows', () => {
    const style = heldPenStyle(main!, INK);
    expect(style.colour!.options).toEqual([{ value: INK_CHOICE, name: 'Ink', swatch: INK }]);
    expect(style.colour!.value).toBe(INK_CHOICE);
    expect(style.width.value).toBe('medium');
    expect(style.subject).toEqual({ kind: 'pen', id: 'main', name: 'Main pen' });
  });

  it('gives another pen its colours, without the ink', () => {
    const style = heldPenStyle(second!, INK);
    expect(style.colour!.options.map((o) => o.name)).not.toContain('Ink');
    expect(style.colour!.value).toBe('#1d7afc');
  });
});

describe('applyPenStyle', () => {
  it('paints a stroke, and puts the ink back by clearing its colour', () => {
    const red = applyPenStyle(stroke(), { colour: '#e5484d' });
    expect(red).toMatchObject({ strokeColor: '#e5484d' });
    expect('strokeColor' in applyPenStyle(red, { colour: INK_CHOICE })).toBe(false);
  });

  it('sets the width in px from its name', () => {
    expect(applyPenStyle(stroke(), { width: 'bold' })).toMatchObject({ penWidth: 2.5 });
  });

  it('leaves anything but a pen stroke alone', () => {
    const shape = createShape('square', 0, 0);
    expect(applyPenStyle(shape, { width: 'bold' })).toBe(shape);
  });
});
