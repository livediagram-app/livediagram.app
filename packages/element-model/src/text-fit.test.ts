import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  fitTextWidth,
  fitTextWidths,
  growTextToLabel,
  TEXT_GROW_MAX,
  textWordsWidth,
  type FitText,
} from './text-fit';

const text = (fields: Partial<FitText> = {}): FitText => ({
  type: 'text',
  x: 100,
  width: 1200,
  label: 'Sprint 14 retro',
  textSize: 'lg',
  textBold: true,
  ...fields,
});

describe('textWordsWidth', () => {
  it('runs wider than the flat headless estimate and the bare advances, so the words never wrap early', () => {
    const w = textWordsWidth(text());
    // 15 glyphs at 32 px: the headless wrap's 0.55 em each is 264 px.
    expect(w).toBeGreaterThan(264);
    expect(w).toBeLessThan(400);
  });

  it('measures the widest line, the case it shows in, its tracking and its padding', () => {
    const one = textWordsWidth(text({ label: 'Short\nA much longer second line' }));
    expect(one).toBe(textWordsWidth(text({ label: 'A much longer second line' })));
    expect(textWordsWidth(text({ textCase: 'upper' }))).toBeGreaterThan(textWordsWidth(text()));
    expect(textWordsWidth(text({ label: 'ABC', textCase: 'lower' }))).toBe(
      textWordsWidth(text({ label: 'abc' })),
    );
    expect(textWordsWidth(text({ letterSpacing: 0.2 }))).toBeGreaterThan(textWordsWidth(text()));
    expect(textWordsWidth(text({ padding: 'md' }))).toBe(textWordsWidth(text()) + 28);
  });

  it('widens bold and heavy words, and scales with a Shift-resized size', () => {
    // Wide capitals, where the advances outrun the flat estimate.
    const wide = { label: 'MOMENTUM', textBold: false };
    const plain = textWordsWidth(text(wide));
    expect(textWordsWidth(text({ ...wide, fontWeight: 700 }))).toBeGreaterThan(plain);
    expect(textWordsWidth(text({ ...wide, textScale: 2 }))).toBeGreaterThan(plain * 1.9);
    expect(textWordsWidth(text({ label: undefined }))).toBe(8);
  });
});

describe('fitTextWidth', () => {
  it('narrows a left-aligned title at its left edge', () => {
    const el = text({ textAlignX: 'left' });
    const fitted = fitTextWidth(el);
    expect(fitted.width).toBe(textWordsWidth(el));
    expect(fitted.x).toBe(100);
  });

  it('keeps a centred text centred, and a right-aligned one at its right edge', () => {
    const centred = fitTextWidth(text());
    expect(centred.x + centred.width / 2).toBe(700);
    const right = fitTextWidth(text({ textAlignX: 'right' }));
    expect(right.x + right.width).toBe(1300);
  });

  it('turns a centred text about the same point', () => {
    const fitted = fitTextWidth(text({ rotation: -90 }));
    expect(fitted.width).toBeLessThan(1200);
    expect(fitted.x + fitted.width / 2).toBe(700);
  });

  it('leaves text it cannot size, or that wraps, as it is', () => {
    const kept: Partial<FitText>[] = [
      { type: 'shape' },
      { label: '  ' },
      { sizing: 'fit' },
      { richText: [] },
      { textArc: 40 },
      { fillColor: '#fff' },
      { strokeColor: '#000' },
      { font: 'abril-fatface' },
      { rotation: 30, textAlignX: 'left' },
      { width: 120 },
    ];
    for (const fields of kept) {
      const el = text(fields);
      expect(fitTextWidth(el)).toBe(el);
    }
    expect(fitTextWidth(text({ font: 'caveat' })).width).toBeLessThan(1200);
  });

  it('fits every text in a list and passes everything else through', () => {
    const shape = { type: 'shape', x: 0, width: 50 };
    const [a, b] = fitTextWidths([shape, text()]);
    expect(a).toBe(shape);
    expect(b!.width).toBeLessThan(1200);
  });

  it('fits a thousand titles in a few milliseconds', () => {
    const many = Array.from({ length: 1000 }, (_, i) => text({ label: `Title number ${i}` }));
    expect(cpuMsOf(() => fitTextWidths(many))).toBeLessThan(50);
  });
});

describe('growTextToLabel', () => {
  const fitted = fitTextWidth(text({ textAlignX: 'left' }));

  it('widens a one-line text to hold longer words on one line, never narrowing', () => {
    const longer = { ...fitted, label: 'Sprint 14 retro, the team in Lisbon' };
    const grown = growTextToLabel(fitted, longer);
    expect(grown.width).toBe(textWordsWidth(longer));
    expect(grown.x).toBe(fitted.x);
    const shorter = { ...fitted, label: 'Retro' };
    expect(growTextToLabel(fitted, shorter)).toBe(shorter);
  });

  it('stops at TEXT_GROW_MAX, past which the words wrap', () => {
    const long = { ...fitted, label: 'word '.repeat(200) };
    expect(growTextToLabel(fitted, long).width).toBe(TEXT_GROW_MAX);
  });

  it('leaves a text whose words already wrapped, and anything but a text', () => {
    const wrapped = { ...fitted, width: 60 };
    const next = { ...wrapped, label: 'Sprint 14 retro, the team in Lisbon' };
    expect(growTextToLabel(wrapped, next)).toBe(next);
    const after = { ...fitted, label: 'Longer words than before, by far' };
    expect(growTextToLabel({ type: 'shape' }, after)).toBe(after);
    const shape = text({ type: 'shape' });
    expect(growTextToLabel(fitted, shape)).toBe(shape);
  });
});
