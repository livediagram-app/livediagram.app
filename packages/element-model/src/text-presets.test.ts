import { describe, expect, it } from 'vitest';
import {
  presetTextFields,
  restyleText,
  splitTextPx,
  textBoxFor,
  textPresetOf,
  type StyledText,
  type TextPreset,
} from './text-presets';

// Each product's docs/specs/008-canvas/canvas-and-palette.md "Text styles".
const HEADING: TextPreset = { id: 'heading', name: 'Heading', px: 32, bold: true };
const PARAGRAPH: TextPreset = { id: 'paragraph', name: 'Paragraph', px: 16, wrapWidth: 320 };
const QUOTE: TextPreset = { id: 'quote', name: 'Quote', px: 20, italic: true, wrapWidth: 320 };
const TITLE: TextPreset = { id: 'title', name: 'Title', px: 64, bold: true };
const TABLE = [TITLE, HEADING, PARAGRAPH, QUOTE];

const text = (fields: Partial<StyledText> = {}): StyledText => ({
  type: 'text',
  width: 200,
  ...fields,
});

describe('splitTextPx', () => {
  it('stores a size up to 48 px whole, and the rest past it as a scale', () => {
    expect(splitTextPx(24.4)).toEqual({ textSize: 24 });
    expect(splitTextPx(0)).toEqual({ textSize: 1 });
    expect(splitTextPx(64)).toEqual({ textSize: 48, textScale: 1.333 });
  });
});

describe('presetTextFields', () => {
  it('fits a heading to its name, left aligned and top first', () => {
    const fields = presetTextFields(HEADING);
    expect(fields).toMatchObject({
      label: 'Heading',
      textSize: 32,
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      sizing: 'fit',
    });
    expect(fields).not.toHaveProperty('textItalic');
    expect(fields.width).toBeGreaterThan(fields.height);
    expect(fields.height).toBe(Math.ceil(32 * 1.25) + 4);
  });

  it('wraps body text at its width, and slants a quote', () => {
    expect(presetTextFields(PARAGRAPH)).toMatchObject({ width: 320, sizing: 'wrap' });
    expect(presetTextFields(PARAGRAPH)).not.toHaveProperty('textBold');
    expect(presetTextFields(QUOTE)).toMatchObject({ textItalic: true, sizing: 'wrap' });
  });

  it('stores a size past 48 px as 48 and a scale', () => {
    expect(presetTextFields(TITLE)).toMatchObject({ textSize: 48, textScale: 1.333 });
  });
});

describe('textBoxFor', () => {
  it('fits a short line and wraps a long one at the width', () => {
    expect(textBoxFor('Hi', 24, 600).width).toBeLessThan(100);
    const one = textBoxFor('x'.repeat(10), 24, 600).height;
    const long = textBoxFor('x'.repeat(100), 24, 600);
    expect(long.width).toBe(600);
    expect(long.height).toBeGreaterThan(one);
  });

  it('takes a row per written line, and a line for no words', () => {
    const one = textBoxFor('a', 24).height;
    expect(textBoxFor('a\nb\nc', 24).height).toBeGreaterThan(2 * one);
    expect(textBoxFor('', 24).height).toBe(one);
    expect(textBoxFor(undefined, 24).height).toBe(one);
  });
});

describe('restyleText', () => {
  it('sets the style size, weight and slant, keeping everything else', () => {
    const before = { ...text({ textSize: 14, textItalic: true }), label: 'Hello', font: 'lora' };
    expect(restyleText(before, HEADING)).toEqual({
      type: 'text',
      width: 200,
      label: 'Hello',
      font: 'lora',
      textSize: 32,
      textBold: true,
      sizing: 'fit',
    });
  });

  it('drops a scale for a size the model stores whole, and keeps one past 48 px', () => {
    const scaled = text({ textSize: 48, textScale: 2 });
    expect(restyleText(scaled, HEADING)).not.toHaveProperty('textScale');
    expect(restyleText(text(), TITLE)).toMatchObject({ textSize: 48, textScale: 1.333 });
  });

  it('lets a wordmark weight give way to the style', () => {
    expect(restyleText(text({ fontWeight: 500 }), PARAGRAPH)).not.toHaveProperty('fontWeight');
    expect(restyleText(text({ textBold: true }), PARAGRAPH)).not.toHaveProperty('textBold');
  });

  it('wraps a fitted text at the style width, and keeps a wrapping text at its own', () => {
    expect(restyleText(text({ sizing: 'fit' }), QUOTE)).toMatchObject({
      sizing: 'wrap',
      width: 320,
      textItalic: true,
    });
    expect(restyleText(text({ sizing: 'wrap', width: 500 }), QUOTE)).toMatchObject({
      sizing: 'wrap',
      width: 500,
    });
    expect(restyleText(text({ sizing: 'wrap' }), HEADING)).toMatchObject({ sizing: 'fit' });
  });

  it('leaves anything but a text as it was', () => {
    const shape = { type: 'shape', width: 100, textSize: 14 } as StyledText;
    expect(restyleText(shape, HEADING)).toBe(shape);
  });
});

describe('textPresetOf', () => {
  it('reads the style a text matches by its drawn size, weight and slant', () => {
    expect(textPresetOf(text({ textSize: 32, textBold: true }), TABLE)).toBe('heading');
    expect(textPresetOf(text({ textSize: 20, textItalic: true }), TABLE)).toBe('quote');
    expect(textPresetOf(text({ textSize: 48, textScale: 1.333 }), TABLE)).toBeNull();
    expect(textPresetOf(text({ textSize: 48, textScale: 1.333, textBold: true }), TABLE)).toBe(
      'title',
    );
  });

  it('reads every style back from the fields it makes', () => {
    for (const preset of TABLE) {
      expect(textPresetOf({ type: 'text', ...presetTextFields(preset) }, TABLE)).toBe(preset.id);
      expect(textPresetOf(restyleText(text(), preset), TABLE)).toBe(preset.id);
    }
  });

  it('reads none off a text styled by hand, or off anything but a text', () => {
    expect(textPresetOf(text({ textSize: 16, textBold: true }), TABLE)).toBeNull();
    expect(textPresetOf(text(), TABLE)).toBeNull();
    expect(
      textPresetOf({ type: 'shape', width: 1, textSize: 32, textBold: true }, TABLE),
    ).toBeNull();
  });
});
