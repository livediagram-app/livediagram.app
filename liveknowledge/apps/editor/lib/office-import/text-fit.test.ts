import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { fitTextBox } from './text-fit';

// docs/specs/020-import-export/office-import.md "Text boxes and placeholders": a no-wrap box is widened to its line,
// a box that sizes to its text grows to its height, and neither leaves the page without wrapping.
const PAGE = { x: 0, width: 1000 };
const text = (label: string, px = 20) => ({ label, px, bold: false });
const box = (x = 10, width = 100, height = 30) => ({ x, y: 0, width, height });

describe('fitTextBox', () => {
  it('leaves a box that states a fixed size as it is', () => {
    expect(
      fitTextBox(box(), text('word '.repeat(40)), { noWrap: false, autoFit: false }, PAGE),
    ).toEqual({ width: 100, height: 30 });
  });

  it('widens a no-wrap box to one line of its text, never narrower or taller', () => {
    const out = fitTextBox(
      box(),
      text('Baseline default textbox, no adjustments'),
      { noWrap: true, autoFit: false },
      PAGE,
    );
    expect(out.width).toBeGreaterThan(100);
    expect(out.width).toBeLessThan(1000 - 10);
    expect(out.height).toBe(30);
    const short = fitTextBox(box(10, 400), text('Hi'), { noWrap: true, autoFit: false }, PAGE);
    expect(short).toEqual({ width: 400, height: 30 });
  });

  it('wraps a no-wrap box only where the page cannot hold its line', () => {
    const out = fitTextBox(
      box(10, 100),
      text('a long line '.repeat(30)),
      { noWrap: true, autoFit: false },
      PAGE,
    );
    expect(out.width).toBe(990);
    expect(out.height).toBeGreaterThan(30);
  });

  it('grows an autofit box to its lines, one a paragraph and more where one wraps', () => {
    const rules = { noWrap: false, autoFit: true };
    const one = fitTextBox(box(10, 400, 10), text('Hi'), rules, PAGE);
    expect(one.height).toBe(29);
    const two = fitTextBox(box(10, 400, 10), text('Hi\nthere'), rules, PAGE);
    expect(two.height).toBe(54);
    const wrapped = fitTextBox(box(10, 100, 10), text('one two three four five six'), rules, PAGE);
    expect(wrapped.height).toBeGreaterThan(54);
    expect(wrapped.width).toBe(100);
    // A taller box is kept.
    expect(fitTextBox(box(10, 400, 500), text('Hi'), rules, PAGE).height).toBe(500);
  });

  it('breaks a word wider than a line over lines', () => {
    const rules = { noWrap: false, autoFit: true };
    const out = fitTextBox(box(10, 100, 10), text('x'.repeat(60)), rules, PAGE);
    expect(out.height).toBeGreaterThan(100);
    const mixed = fitTextBox(box(10, 100, 10), text('ab ' + 'x'.repeat(60) + ' cd'), rules, PAGE);
    expect(mixed.height).toBeGreaterThanOrEqual(out.height);
  });

  it('stays linear for tens of thousands of characters and spaces', () => {
    const rules = { noWrap: false, autoFit: true };
    const long = fitTextBox(box(), text(' '.repeat(50_000) + 'w'.repeat(50_000)), rules, PAGE);
    expect(long.height).toBeGreaterThan(0);
    const ms = cpuMsOf(() => {
      fitTextBox(box(), text('ab '.repeat(30_000)), rules, PAGE);
      fitTextBox(box(), text('x'.repeat(100_000)), { noWrap: true, autoFit: true }, PAGE);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});
