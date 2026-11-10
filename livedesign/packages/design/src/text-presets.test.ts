import { describe, expect, it } from 'vitest';
import { labelFontPx, TEXT_PX_MAX, TEXT_PX_MIN } from '@liveworkspace/model-core/label-font';
import { createShape } from './factories';
import {
  applyTextPreset,
  createPresetText,
  DEFAULT_TEXT_PRESET,
  TEXT_PRESET_IDS,
  TEXT_PRESET_LIST,
  TEXT_PRESETS,
  TEXT_STYLE_WRAP_WIDTH,
  textPresetOfElement,
} from './text-presets';

// docs/specs/008-canvas/canvas-and-palette.md "Text styles".
describe("Write's text styles", () => {
  it('are the kinds of text a screen is set in, largest first, then body text, then small print', () => {
    expect(TEXT_PRESET_LIST.map((p) => p.name)).toEqual([
      'Title',
      'Subtitle',
      'Heading',
      'Subheading',
      'Paragraph',
      'Quote',
      'Caption',
    ]);
    const { title, heading, subheading, paragraph, caption } = TEXT_PRESETS;
    expect(title.px).toBeGreaterThan(heading.px);
    expect(heading.px).toBeGreaterThan(subheading.px);
    expect(subheading.px).toBeGreaterThan(paragraph.px);
    expect(paragraph.px).toBeGreaterThan(caption.px);
    expect(DEFAULT_TEXT_PRESET).toBe('paragraph');
  });

  it('all sit on the Size slider, so none stores a scale', () => {
    for (const id of TEXT_PRESET_IDS) {
      const el = createPresetText(0, 0, id);
      expect(el.textScale).toBeUndefined();
      expect(labelFontPx(el.textSize)).toBe(TEXT_PRESETS[id].px);
      expect(TEXT_PRESETS[id].px).toBeGreaterThanOrEqual(TEXT_PX_MIN);
      expect(TEXT_PRESETS[id].px).toBeLessThanOrEqual(TEXT_PX_MAX);
    }
  });

  it('tells every style apart by its size, weight and slant, so the menu can show which one a text wears', () => {
    const looks = TEXT_PRESET_LIST.map((p) => `${p.px}/${p.bold ?? false}/${p.italic ?? false}`);
    expect(new Set(looks).size).toBe(looks.length);
  });

  it('makes each style a left-aligned text that starts with its name', () => {
    for (const id of TEXT_PRESET_IDS) {
      const el = createPresetText(10, 20, id);
      expect(el).toMatchObject({
        type: 'text',
        x: 10,
        y: 20,
        label: TEXT_PRESETS[id].name,
        textAlignX: 'left',
        textAlignY: 'top',
      });
      expect(textPresetOfElement(el)).toBe(id);
    }
  });

  it("fits a heading to its words and wraps body text at a phone's column", () => {
    expect(createPresetText(0, 0, 'heading')).toMatchObject({ sizing: 'fit', textBold: true });
    expect(createPresetText(0, 0, 'paragraph')).toMatchObject({
      sizing: 'wrap',
      width: TEXT_STYLE_WRAP_WIDTH,
    });
    expect(createPresetText(0, 0, 'quote')).toMatchObject({ sizing: 'wrap', textItalic: true });
    expect(createPresetText(0, 0, 'caption')).toMatchObject({ sizing: 'fit', textSize: 12 });
    expect(TEXT_STYLE_WRAP_WIDTH).toBeLessThan(390);
  });
});

describe('restyling a text', () => {
  it('switches a text to another style, keeping its words', () => {
    const heading = { ...createPresetText(0, 0, 'heading'), label: 'Pricing' };
    const quote = applyTextPreset(heading, 'quote');
    expect(quote).toMatchObject({
      label: 'Pricing',
      textSize: 20,
      textItalic: true,
      sizing: 'wrap',
    });
    expect(quote).not.toHaveProperty('textBold');
    expect(textPresetOfElement(quote)).toBe('quote');
  });

  it('leaves anything but a text alone, and reads no style off it', () => {
    const shape = createShape('square', 0, 0);
    expect(applyTextPreset(shape, 'title')).toBe(shape);
    expect(textPresetOfElement(shape)).toBeNull();
  });
});
