import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { hasRightToLeftLetter, labelEditorBidi } from './label-bidi';

// canvas-performance.md "Typing in a long label stays light": the editor lays its text out line by line only when
// its lines could read in different directions.
describe('labelEditorBidi', () => {
  it('lays left-to-right text out as one run, however many lines', () => {
    expect(labelEditorBidi('')).toBe('isolate');
    expect(labelEditorBidi('Hello world!')).toBe('isolate');
    expect(labelEditorBidi('One\nTwo\n3.')).toBe('isolate');
  });

  it('lays one line of right-to-left text out as one run in its first letter direction', () => {
    expect(labelEditorBidi('مرحبا بالعالم!')).toBe('isolate');
    expect(labelEditorBidi('Hello שלום')).toBe('isolate');
  });

  it('lays right-to-left text over several lines out line by line', () => {
    expect(labelEditorBidi('Hello\nمرحبا بالعالم!')).toBe('plaintext');
    expect(labelEditorBidi('שלום\nworld')).toBe('plaintext');
  });

  it('finds the right-to-left letters of every block, astral ones included', () => {
    for (const letter of ['א', 'ب', 'ܐ', 'ހ', 'ߊ', 'ࠀ', 'ࡀ', 'ﭐ', 'ﹰ', '\u{10800}', '\u{1E900}']) {
      expect(hasRightToLeftLetter(`abc ${letter}`)).toBe(true);
    }
    expect(hasRightToLeftLetter('abc 123 Ωλ 漢字 😀')).toBe(false);
  });

  it('reads a 100,000-character text inside a keystroke budget', () => {
    const line = 'lorem ipsum dolor sit amet '.repeat(4000).slice(0, 100_000);
    const lines = `${line.slice(0, 50_000)}\n${line.slice(50_000)}`;
    expect(labelEditorBidi(line)).toBe('isolate');
    expect(labelEditorBidi(lines)).toBe('isolate');
    let best = Infinity;
    for (let i = 0; i < 5; i++)
      best = Math.min(
        best,
        cpuMsOf(() => labelEditorBidi(lines)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(5));
  });
});
