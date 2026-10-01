import { describe, expect, it } from 'vitest';
import {
  createShape,
  defaultScheme,
  penColourHex,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type TextElement,
} from '@livediagram/document';
import { quickStyleView } from './quick-style';
import { applyBoardStroke, applyBoardTextColour, onWhiteboard } from './quick-style-whiteboard';
import { INK_CHOICE, type PenPalette } from './quick-style-pen';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": a whiteboard has no theme,
// so its Stroke and Text colour rows offer the whiteboard's colours (Ink, the seven stock colours,
// the tab's custom colours), as Marker colour does; Background keeps its fills, "no fill" first.
const INK = '#1c1917';
const palette: PenPalette = { board: 'light', ink: INK, custom: [] };
const shape = { ...createShape('square', 0, 0), fillColor: 'transparent' } as ShapeElement;
const text = { id: 't', type: 'text', x: 0, y: 0, width: 9, height: 9, label: 'Hi' } as TextElement;
const arrow = {
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 9, y: 9 },
} as ArrowElement;
const EIGHT = ['Ink', 'Blue', 'Red', 'Orange', 'Green', 'Teal', 'Violet', 'Pink'];

const view = (els: Element[], p: PenPalette = palette) =>
  onWhiteboard(quickStyleView(els, defaultScheme('light')), els, p)!;

describe('onWhiteboard', () => {
  it('offers the whiteboard’s colours for Stroke and Text colour, in place of the theme’s', () => {
    const v = view([shape, text]);
    expect(v.sections.stroke).toBeUndefined();
    expect(v.sections.textColour).toBeUndefined();
    expect(v.sections.boardStroke!.options.map((o) => o.name)).toEqual(EIGHT);
    expect(v.sections.boardText!.options.map((o) => o.name)).toEqual(EIGHT);
    expect(v.sections.boardStroke!.options[0]!.swatch).toBe(INK);
    expect(v.sections.boardStroke!.options[1]!.swatch).toBe(penColourHex('blue', 'light'));
    expect(v.sections.boardStroke!.custom).toEqual([]);
  });

  it('marks the ink, a stock name and a custom colour, and nothing when they disagree', () => {
    expect(view([shape]).sections.boardStroke!.value).toBe(INK_CHOICE);
    expect(view([{ ...shape, penColour: 'blue' }]).sections.boardStroke!.value).toBe('blue');
    const custom = { ...arrow, strokeColor: '#868E96' };
    const p = { ...palette, custom: ['#868e96'] };
    const v = view([custom], p);
    expect(v.sections.boardStroke!.value).toBe('#868e96');
    expect(v.sections.boardStroke!.custom.map((o) => o.value)).toEqual(['#868e96']);
    expect(view([shape, { ...arrow, penColour: 'red' }]).sections.boardStroke!.value).toBeNull();
    expect(view([{ ...text, penTextColour: 'green' }]).sections.boardText!.value).toBe('green');
  });

  it('keeps the background’s fills, no fill first, and reads an unfilled shape as it', () => {
    const v = view([shape]);
    expect(v.sections.background!.swatches[0]!.color).toBe('transparent');
    expect(v.sections.background!.value).toBe(0);
    const odd = { ...shape, fillColor: '#123456' } as Element;
    expect(view([odd]).sections.background!.value).toBeNull();
  });

  it('passes a missing view through', () => {
    expect(onWhiteboard(null, [], palette)).toBeNull();
  });
});

describe('applyBoardStroke', () => {
  it('stores the ink as no colour, a stock colour by name, a custom one as its hex', () => {
    const painted = {
      ...shape,
      strokeColor: '#ff0000',
      strokeSwatch: 2,
      colorPreset: 'bold',
    } as ShapeElement;
    const ink = applyBoardStroke(painted, INK_CHOICE) as ShapeElement;
    expect(ink.strokeColor).toBeUndefined();
    expect(ink.penColour).toBeUndefined();
    expect(ink.strokeSwatch).toBeUndefined();
    expect(ink.colorPreset).toBeUndefined();
    const blue = applyBoardStroke(painted, 'blue') as ShapeElement;
    expect(blue).toMatchObject({ penColour: 'blue' });
    expect(blue.strokeColor).toBeUndefined();
    const hex = applyBoardStroke({ ...arrow, penColour: 'red' }, '#868e96') as ArrowElement;
    expect(hex.strokeColor).toBe('#868e96');
    expect(hex.penColour).toBeUndefined();
  });

  it('leaves what it does not fit alone', () => {
    expect(applyBoardStroke(text, 'blue')).toBe(text);
    const locked = { ...shape, locked: true };
    expect(applyBoardStroke(locked, 'blue')).toBe(locked);
  });
});

describe('applyBoardTextColour', () => {
  it('colours a text box by name, by hex, or back to the ink', () => {
    expect(applyBoardTextColour(text, 'violet')).toMatchObject({ penTextColour: 'violet' });
    const hex = applyBoardTextColour({ ...text, penTextColour: 'red', textSwatch: 1 }, '#0c8599');
    expect(hex).toMatchObject({ textColor: '#0c8599' });
    expect((hex as TextElement).penTextColour).toBeUndefined();
    expect((hex as TextElement).textSwatch).toBeUndefined();
    const ink = applyBoardTextColour({ ...text, textColor: '#0c8599' }, INK_CHOICE) as TextElement;
    expect(ink.textColor).toBeUndefined();
    expect(applyBoardTextColour(shape, 'violet')).toBe(shape);
  });
});
