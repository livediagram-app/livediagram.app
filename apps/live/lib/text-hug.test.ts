import { describe, expect, it } from 'vitest';
import {
  createText,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type TextElement,
} from '@livediagram/document';
import {
  hugCommittedText,
  hugResizedText,
  hugsText,
  hugTextSize,
  placedTextBox,
  TEXT_HUG_MAX_WIDTH,
  textHugFontPx,
  textHugPadding,
  textHugPaddingCss,
  type MeasureTextBlock,
} from './text-hug';

// A stand-in for the DOM measurer: every character is half the font px wide, a line is the
// font px times the leading, and the text wraps at the width it is given.
function fakeMeasure(el: TextElement): MeasureTextBlock {
  const px = textHugFontPx(el);
  const natural = (el.label ?? '').length * px * 0.5;
  return (width, fixed) => {
    const lines = Math.max(1, Math.ceil(natural / width));
    return { width: fixed ? width : Math.min(natural, width), height: lines * px * 1.25 };
  };
}

function text(patch: Partial<TextElement> = {}): TextElement {
  return { ...createText(0, 0), label: 'Hello', ...patch };
}

describe('hugsText', () => {
  // docs/specs/007-editor/editor-modes.md "A text box's sizing": keyed on the element, in both
  // editor modes, never on the mode.
  it('holds for a text box that fits or wraps, and never for a fixed box', () => {
    expect(hugsText(text({ sizing: 'fit' }))).toBe(true);
    expect(hugsText(text({ sizing: 'wrap' }))).toBe(true);
    expect(hugsText(text())).toBe(false);
    expect(hugsText({ ...text(), type: 'sticky', sizing: 'fit' } as never)).toBe(false);
  });
});

describe('textHugPadding', () => {
  it('pads 4 px left and right and 2 px top and bottom', () => {
    expect(textHugPadding(text())).toEqual({ x: 4, y: 2 });
    expect(textHugPaddingCss(text())).toBe('2px 4px');
  });

  it('takes an explicit padding preset on every side', () => {
    expect(textHugPadding(text({ padding: 'none' }))).toEqual({ x: 0, y: 0 });
    expect(textHugPadding(text({ padding: 'sm' }))).toEqual({ x: 6, y: 6 });
  });
});

describe('textHugFontPx', () => {
  it('draws the size preset, and scale at its fixed px', () => {
    expect(textHugFontPx(text({ textSize: 'sm' }))).toBe(14);
    expect(textHugFontPx(text({ textSize: 'scale' }))).toBe(16);
  });

  it('multiplies by the Shift-resize scale', () => {
    expect(textHugFontPx(text({ textSize: 'sm', textScale: 2 }))).toBe(28);
  });
});

describe('hugTextSize', () => {
  it('fits an auto-width box to its text plus the padding', () => {
    const el = text({ sizing: 'fit', label: 'Hello' }); // 5 x 7 = 35 wide, 17.5 tall
    expect(hugTextSize(el, fakeMeasure(el))).toEqual({ width: 43, height: 22 });
  });

  it('wraps an auto-width box at the wrap width', () => {
    const el = text({ sizing: 'fit', label: 'x'.repeat(100) }); // 700 natural
    const size = hugTextSize(el, fakeMeasure(el));
    expect(size.width).toBe(TEXT_HUG_MAX_WIDTH);
    expect(size.height).toBe(Math.ceil(2 * 17.5) + 4);
  });

  it('keeps a set width and hugs the height', () => {
    const el = text({ sizing: 'wrap', width: 28, label: 'Hello' }); // 20 px of text area, 35 of text
    expect(hugTextSize(el, fakeMeasure(el))).toEqual({ width: 28, height: 35 + 4 });
  });
});

describe('placedTextBox', () => {
  const drag = { x: 10, y: 20, width: 200, height: 90 };

  it('puts a click-placed box empty, fitting its words, with the caret at the click', () => {
    const box = placedTextBox(text({ textSize: 'sm' }), true, { x: 100, y: 50 }, drag);
    expect(box).toEqual({ label: '', sizing: 'fit', x: 96, y: 39, width: 8, height: 22 });
  });

  it('takes the dragged width, wrapping, and one line of height from a drag', () => {
    const box = placedTextBox(text({ textSize: 'sm' }), false, { x: 10, y: 20 }, drag);
    expect(box).toEqual({ label: '', sizing: 'wrap', x: 10, y: 20, width: 200, height: 22 });
  });
});

describe('hugResizedText', () => {
  const measure = fakeMeasure;

  it('sets the width from a side handle, so the box wraps, and hugs the height', () => {
    const el = text({ sizing: 'fit', x: 0, y: 0, width: 43, height: 22, label: 'x'.repeat(10) });
    const out = hugResizedText(
      el,
      { x: 0, y: 0, width: 43, height: 22 },
      'resize-e',
      false,
      measure,
    );
    expect(out.sizing).toBe('wrap');
    // 70 px of text in a 35 px text area: two lines.
    expect(out).toMatchObject({ x: 0, y: 0, width: 43, height: 35 + 4 });
  });

  it('keeps the bottom edge for a top-corner handle', () => {
    const el = text({ x: 0, y: 100, width: 200, height: 22, label: 'x'.repeat(40) });
    const out = hugResizedText(
      el,
      { x: 0, y: 60, width: 144, height: 62 },
      'resize-ne',
      false,
      measure,
    );
    // 280 px of text in 136: three lines, 53 tall.
    expect(out).toMatchObject({ width: 144, height: 57, y: 122 - 57 });
  });

  it('leaves the width, and a fit to the words, to the top and bottom handles', () => {
    const el = text({ sizing: 'fit', width: 43, height: 22, label: 'Hello' });
    const out = hugResizedText(
      el,
      { x: 0, y: 0, width: 43, height: 80 },
      'resize-s',
      false,
      measure,
    );
    expect(out).toMatchObject({ sizing: 'fit', width: 43, height: 22 });
  });

  it('scales the text with the box under Shift, keeping its lines', () => {
    const el = text({ x: 0, y: 0, width: 43, height: 22, textSize: 'sm', label: 'Hello' });
    const out = hugResizedText(
      el,
      { x: 0, y: 0, width: 78, height: 40 },
      'resize-se',
      true,
      measure,
    );
    // Text area 35 -> 70: twice the text.
    expect(out.textScale).toBe(2);
    expect(out).toMatchObject({ x: 0, y: 0, width: 78, height: 35 + 4 });
  });

  it('scales about the middle for a side handle under Shift', () => {
    const el = text({ x: 0, y: 0, width: 43, height: 22, textSize: 'sm', label: 'Hello' });
    const out = hugResizedText(
      el,
      { x: 0, y: -9, width: 78, height: 40 },
      'resize-e',
      true,
      measure,
    );
    expect(out.y).toBe(-9 + (40 - 39) / 2);
  });

  it('holds the scale within its bounds', () => {
    const el = text({ x: 0, y: 0, width: 43, height: 22, textScale: 39, label: 'Hello' });
    const out = hugResizedText(
      el,
      { x: 0, y: 0, width: 430, height: 220 },
      'resize-se',
      true,
      measure,
    );
    expect(out.textScale).toBe(TEXT_SCALE_MAX);
    const small = hugResizedText(
      text({ width: 43, height: 22, textScale: 0.2, label: 'Hello' }),
      { x: 0, y: 0, width: 20, height: 10 },
      'resize-se',
      true,
      measure,
    );
    expect(small.textScale).toBe(TEXT_SCALE_MIN);
  });

  it('keeps a fit to the words under Shift', () => {
    const el = text({ sizing: 'fit', width: 43, height: 22, label: 'Hello' });
    const out = hugResizedText(
      el,
      { x: 0, y: 0, width: 78, height: 40 },
      'resize-se',
      true,
      measure,
    );
    expect(out.sizing).toBe('fit');
  });
});

describe('hugCommittedText', () => {
  it('removes a text box left empty', () => {
    expect(hugCommittedText(text({ label: '' }), fakeMeasure)).toBeNull();
    expect(hugCommittedText(text({ label: ' \n ' }), fakeMeasure)).toBeNull();
  });

  it('sizes a committed text box to hug its text', () => {
    const el = text({ sizing: 'fit', width: 8, height: 22, label: 'Hello' });
    expect(hugCommittedText(el, fakeMeasure)).toMatchObject({
      label: 'Hello',
      width: 43,
      height: 22,
    });
  });

  it('keeps an existing set width and hugs the height', () => {
    const el = text({ sizing: 'wrap', width: 220, height: 64, label: 'Hello' });
    expect(hugCommittedText(el, fakeMeasure)).toMatchObject({ width: 220, height: 22 });
  });
});
