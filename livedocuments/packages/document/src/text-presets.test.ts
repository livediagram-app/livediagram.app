import { describe, expect, it } from 'vitest';
import { DOCUMENT_TEXT_PX_MAX, DOCUMENT_TEXT_PX_MIN, labelTextScale } from './label-text-scale';
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import { createPresetText, TEXT_PRESET_IDS, TEXT_PRESETS, textBoxFor } from './text-presets';

// docs/specs/008-canvas/canvas-and-palette.md "Text styles".
describe("Write's text styles", () => {
  it('are the styles a document is written in, each named for itself, largest heading first', () => {
    expect(TEXT_PRESET_IDS.map((id) => TEXT_PRESETS[id].name)).toEqual([
      'Title',
      'Subtitle',
      'Heading',
      'Subheading',
      'Paragraph',
      'Quote',
    ]);
    const { title, heading, subheading, paragraph } = TEXT_PRESETS;
    expect(title.px).toBeGreaterThan(heading.px);
    expect(heading.px).toBeGreaterThan(subheading.px);
    expect(subheading.px).toBeGreaterThan(paragraph.px);
  });

  it("all draw at a size on a document's Size slider", () => {
    for (const id of TEXT_PRESET_IDS) {
      const el = createPresetText(0, 0, id);
      const drawn = labelFontPx(el.textSize) * labelTextScale(el);
      expect(Math.round(drawn)).toBe(TEXT_PRESETS[id].px);
      expect(drawn).toBeGreaterThanOrEqual(DOCUMENT_TEXT_PX_MIN);
      expect(drawn).toBeLessThanOrEqual(DOCUMENT_TEXT_PX_MAX);
    }
  });

  it('makes every style a left-aligned text that starts with its name', () => {
    for (const id of TEXT_PRESET_IDS) {
      expect(createPresetText(10, 20, id)).toMatchObject({
        type: 'text',
        x: 10,
        y: 20,
        label: TEXT_PRESETS[id].name,
        textAlignX: 'left',
        textAlignY: 'top',
      });
    }
  });

  it('fits a heading to its words and wraps body text at its width', () => {
    expect(createPresetText(0, 0, 'heading')).toMatchObject({
      sizing: 'fit',
      textBold: true,
      textSize: 48,
    });
    expect(createPresetText(0, 0, 'paragraph')).toMatchObject({
      sizing: 'wrap',
      width: 600,
      textSize: 24,
    });
    expect(createPresetText(0, 0, 'quote')).toMatchObject({ sizing: 'wrap', textItalic: true });
    expect(createPresetText(0, 0, 'subtitle')).not.toHaveProperty('textBold');
  });

  it('stores a Title past 48 px as 48 with the rest as its scale', () => {
    const title = createPresetText(0, 0, 'title');
    expect(title.textSize).toBe(48);
    expect(title.textScale).toBeCloseTo(64 / 48, 3);
  });
});

describe('a box for known words', () => {
  it('fits a short line and wraps a long one at the width', () => {
    const short = textBoxFor('Hi', 24, 600);
    expect(short.width).toBeLessThan(100);
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
