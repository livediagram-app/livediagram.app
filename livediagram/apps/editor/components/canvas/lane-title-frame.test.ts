// A lane title's frame (docs/specs/009-elements/lane.md "A title wraps in its gutter", Work Tracker 444).
import { describe, expect, it } from 'vitest';
import { acrossTitleStrip, uprightTitleStrip } from '@livediagram/document';
import { laneTitleFrame, laneTitleText } from './lane-title-frame';

const lane = { width: 900, height: 200 };

describe('laneTitleFrame', () => {
  it('lays an across title out in its side gutter, keeping the whole-word lines it is given', () => {
    const frame = laneTitleFrame({ ...lane, textAlignX: 'left' }, null, false, true);
    expect(frame?.style).toMatchObject({
      left: 0,
      top: 0,
      width: 132,
      height: 200,
      overflow: 'hidden',
    });
    expect(frame?.className).toBe('[&>div>div]:whitespace-pre');
  });

  it('clamps a formatted title by CSS, never breaking inside a word', () => {
    const frame = laneTitleFrame({ ...lane, textAlignX: 'left' }, null, false, false);
    expect(frame?.className).toBe('[&>div>div]:line-clamp-3 [&_*]:[overflow-wrap:normal]');
  });

  it('follows the gutter to the right and to a seam someone dragged', () => {
    const frame = laneTitleFrame(
      { ...lane, textAlignX: 'right', headerSize: 180 },
      null,
      false,
      true,
    );
    expect(frame?.style).toMatchObject({ left: 720, width: 180 });
  });

  it('clips nothing while editing, so the whole title stays in view', () => {
    const frame = laneTitleFrame({ ...lane, textAlignX: 'left' }, null, true, false);
    expect(frame?.style.overflow).toBe('visible');
    expect(frame?.className).toBeUndefined();
  });

  it('leaves a band title the lane’s width', () => {
    expect(
      laneTitleFrame({ ...lane, textAlignX: 'center', textAlignY: 'top' }, null, false, true),
    ).toBe(null);
  });

  it('turns an upright title in its strip, unclamped as before', () => {
    const el = { ...lane, textAlignX: 'left' as const, titleOrientation: 'upright' as const };
    const frame = laneTitleFrame(el, uprightTitleStrip(el, el.width, el.height), false, true);
    expect(frame?.style.transform).toBe('rotate(-90deg)');
    expect(frame?.className).toBeUndefined();
  });
});

describe('laneTitleText', () => {
  // Half the px a character: the default gutter (132) less the small padding both sides (6) and a pixel is 119 px,
  // 14 characters at 16 px.
  const measureAt = (px: number) => (s: string) => [...s].length * (px / 2);
  const strip = acrossTitleStrip({ textAlignX: 'left' }, 900, 200)!;
  const text = { px: 16, bold: false, italic: false, fontFamily: undefined };
  const fit = (label: string, t = text) => laneTitleText(label, strip, 6, t, measureAt);

  it('reads a common two-word name whole, one word a line, at its own size', () => {
    expect(fit('Customer Engineering')).toEqual({ text: 'Customer\nEngineering', px: 16 });
    expect(fit('Sales')).toEqual({ text: 'Sales', px: 16 });
  });

  it('steps down a size so a long word still reads whole', () => {
    // 14 characters at 22 px is 154 px; at 17 px, 119.
    expect(fit('Infrastructure', { ...text, px: 22 })).toEqual({ text: 'Infrastructure', px: 17 });
  });

  it('ends a word too wide even at the small size in an ellipsis, and a long title past three lines', () => {
    expect(fit('Internationalisation').text).toBe('Internationalisa\u2026');
    const long = fit(
      'Quarterly marketing programme review and sign off with every regional lead',
    ).text.split('\n');
    expect(long).toHaveLength(3);
    expect(long[2]).toMatch(/\u2026$/);
  });
});
