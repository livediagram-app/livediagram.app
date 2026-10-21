import {
  PEN_INK,
  THEMES,
  defaultScheme,
  type ShapeElement,
  type TextElement,
} from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { applyQuickStroke, applyQuickTextColour, quickStyleView, QUICK_INK } from './quick-style';

// docs/specs/007-editor/editor-modes.md "One look": in Diagram mode Ink is the eighth swatch of the
// Stroke and Text colour rows, after the theme's colours, stored by name.

const forest = THEMES.find((t) => t.id === 'forest')!;
const shape = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...extra,
});
const text = (extra: Partial<TextElement> = {}): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 80,
  height: 24,
  label: 'Hi',
  ...extra,
});

describe('the Ink swatch', () => {
  it('offers Ink after the theme colours, in the Stroke and Text colour rows only', () => {
    const view = quickStyleView([shape(), text()], forest, {}, PEN_INK.dark)!;
    expect(view.sections.stroke!.ink).toBe(PEN_INK.dark);
    expect(view.sections.textColour!.ink).toBe(PEN_INK.dark);
    expect(view.sections.background).not.toHaveProperty('ink');
  });

  it('defaults to the Ink for the theme canvas when no canvas is given', () => {
    const view = quickStyleView([shape()], defaultScheme('dark'))!;
    expect(view.sections.stroke!.ink).toBe(PEN_INK.dark);
  });

  it('marks Ink when every target stores it by name', () => {
    const view = quickStyleView(
      [shape({ penColour: 'ink' }), text({ penTextColour: 'ink' })],
      forest,
    )!;
    expect(view.sections.stroke!.value).toBe(QUICK_INK);
    expect(view.sections.textColour!.value).toBe(QUICK_INK);
  });

  it('marks nothing for another stock name, or for unpainted text', () => {
    expect(
      quickStyleView([shape({ penColour: 'blue' })], forest)!.sections.stroke!.value,
    ).toBeNull();
    expect(quickStyleView([text()], forest)!.sections.textColour!.value).toBe(0);
  });

  it('stores Ink by name on a line, replacing a colour, its swatch and its preset', () => {
    const painted = shape({ strokeColor: '#ff0000', strokeSwatch: 2, colorPreset: 'bold' });
    const out = applyQuickStroke(painted, forest, QUICK_INK) as ShapeElement;
    expect(out.penColour).toBe('ink');
    expect(out.strokeColor).toBeUndefined();
    expect(out.strokeSwatch).toBeUndefined();
    expect(out.colorPreset).toBeUndefined();
  });

  it('stores Ink by name on a text box, replacing its colour and swatch', () => {
    const out = applyQuickTextColour(
      text({ textColor: '#123456', textSwatch: 3 }),
      forest,
      QUICK_INK,
    ) as TextElement;
    expect(out.penTextColour).toBe('ink');
    expect(out.textColor).toBeUndefined();
    expect(out.textSwatch).toBeUndefined();
  });

  it('replaces a stored Ink when a theme swatch is chosen', () => {
    const out = applyQuickStroke(shape({ penColour: 'ink' }), forest, 1) as ShapeElement;
    expect(out.penColour).toBeUndefined();
    expect(out.strokeColor).toBeDefined();
  });
});
