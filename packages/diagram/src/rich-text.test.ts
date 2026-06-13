import { describe, expect, it } from 'vitest';
import {
  applyFormatToRange,
  hasRichFormatting,
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  setRunsPlainText,
  toggleFormatInRange,
  type TextRun,
} from './rich-text';

describe('runsPlainText / runsFromPlainText', () => {
  it('joins run text and round-trips a plain string', () => {
    const runs: TextRun[] = [{ text: 'Hello ' }, { text: 'world', bold: true }];
    expect(runsPlainText(runs)).toBe('Hello world');
    expect(runsFromPlainText('Hello world')).toEqual([{ text: 'Hello world' }]);
    expect(runsFromPlainText('')).toEqual([]);
  });
});

describe('normalizeRuns', () => {
  it('drops empty runs and merges adjacent runs with identical attrs', () => {
    const runs: TextRun[] = [
      { text: 'a', bold: true },
      { text: '' },
      { text: 'b', bold: true },
      { text: 'c' },
    ];
    expect(normalizeRuns(runs)).toEqual([{ text: 'ab', bold: true }, { text: 'c' }]);
  });

  it('treats an absent attr and explicit undefined as equal', () => {
    const runs: TextRun[] = [{ text: 'a' }, { text: 'b', bold: undefined }];
    expect(normalizeRuns(runs)).toEqual([{ text: 'ab' }]);
  });

  it('is idempotent', () => {
    const runs: TextRun[] = [
      { text: 'red', color: '#ff0000' },
      { text: 'red2', color: '#ff0000' },
      { text: 'plain' },
    ];
    const once = normalizeRuns(runs);
    expect(normalizeRuns(once)).toEqual(once);
  });

  it('returns [] for all-empty input', () => {
    expect(normalizeRuns([{ text: '' }, { text: '' }])).toEqual([]);
  });
});

describe('applyFormatToRange', () => {
  it('formats a slice inside a single run (3-way split)', () => {
    const runs = runsFromPlainText('abcdef');
    // bold 'cd' (offsets 2..4)
    const out = applyFormatToRange(runs, 2, 4, { bold: true });
    expect(out).toEqual([{ text: 'ab' }, { text: 'cd', bold: true }, { text: 'ef' }]);
    expect(runsPlainText(out)).toBe('abcdef');
  });

  it('formats across run boundaries and merges', () => {
    const runs: TextRun[] = [{ text: 'foo' }, { text: 'bar', italic: true }];
    const out = applyFormatToRange(runs, 1, 5, { color: '#123456' });
    // 'oo' + 'ba' get the color; 'ba' keeps italic; merge keeps boundaries
    expect(runsPlainText(out)).toBe('foobar');
    expect(out).toEqual([
      { text: 'f' },
      { text: 'oo', color: '#123456' },
      { text: 'ba', italic: true, color: '#123456' },
      { text: 'r', italic: true },
    ]);
  });

  it('covers the whole text', () => {
    const out = applyFormatToRange(runsFromPlainText('hi'), 0, 2, { size: 'lg' });
    expect(out).toEqual([{ text: 'hi', size: 'lg' }]);
  });

  it('clamps out-of-range offsets and no-ops an empty range', () => {
    const runs = runsFromPlainText('abc');
    expect(applyFormatToRange(runs, 5, 9, { bold: true })).toEqual([{ text: 'abc' }]);
    expect(applyFormatToRange(runs, 2, 2, { bold: true })).toEqual([{ text: 'abc' }]);
    expect(applyFormatToRange(runs, -3, 99, { bold: true })).toEqual([{ text: 'abc', bold: true }]);
  });

  it('clears a delta when the patch value is undefined', () => {
    const runs: TextRun[] = [{ text: 'abc', bold: true }];
    const out = applyFormatToRange(runs, 0, 3, { bold: undefined });
    expect(out).toEqual([{ text: 'abc' }]);
  });
});

describe('toggleFormatInRange', () => {
  it('turns ON when not all chars are effectively-on', () => {
    const runs: TextRun[] = [{ text: 'ab', bold: true }, { text: 'cd' }];
    const out = toggleFormatInRange(runs, 0, 4, 'bold', false);
    expect(out).toEqual([{ text: 'abcd', bold: true }]);
  });

  it('turns OFF when every char is already effectively-on', () => {
    const runs: TextRun[] = [{ text: 'abcd', bold: true }];
    const out = toggleFormatInRange(runs, 0, 4, 'bold', false);
    expect(out).toEqual([{ text: 'abcd', bold: false }]);
  });

  it('respects the element default for the effective value', () => {
    // No explicit run flags, but the element is bold by default => the
    // whole range is effectively-on => toggle writes explicit false.
    const runs = runsFromPlainText('abcd');
    const out = toggleFormatInRange(runs, 0, 4, 'bold', true);
    expect(out).toEqual([{ text: 'abcd', bold: false }]);
  });

  it('toggles only the covered range', () => {
    const runs = runsFromPlainText('abcd');
    const out = toggleFormatInRange(runs, 1, 3, 'italic', false);
    expect(out).toEqual([{ text: 'a' }, { text: 'bc', italic: true }, { text: 'd' }]);
  });
});

describe('setRunsPlainText', () => {
  it('appends inheriting the last run attrs', () => {
    const runs: TextRun[] = [{ text: 'bold', bold: true }];
    const out = setRunsPlainText(runs, 'boldXY');
    expect(out).toEqual([{ text: 'boldXY', bold: true }]);
  });

  it('inserts in the middle inheriting the surrounding run', () => {
    const runs: TextRun[] = [{ text: 'abc', italic: true }];
    const out = setRunsPlainText(runs, 'abXYZc');
    expect(out).toEqual([{ text: 'abXYZc', italic: true }]);
  });

  it('preserves attrs of the unedited prefix and suffix', () => {
    const runs: TextRun[] = [{ text: 'AAA', bold: true }, { text: 'BBB' }];
    // delete the middle 'AB' -> 'AA' + 'BB'
    const out = setRunsPlainText(runs, 'AABB');
    expect(runsPlainText(out)).toBe('AABB');
    expect(out).toEqual([{ text: 'AA', bold: true }, { text: 'BB' }]);
  });

  it('returns [] on full clear and no-ops an unchanged string', () => {
    const runs: TextRun[] = [{ text: 'abc', bold: true }];
    expect(setRunsPlainText(runs, '')).toEqual([]);
    expect(setRunsPlainText(runs, 'abc')).toEqual([{ text: 'abc', bold: true }]);
  });
});

describe('hasRichFormatting', () => {
  it('is false for absent / empty / single override-free run', () => {
    expect(hasRichFormatting(undefined)).toBe(false);
    expect(hasRichFormatting([])).toBe(false);
    expect(hasRichFormatting([{ text: 'plain' }])).toBe(false);
  });

  it('is true for any override', () => {
    expect(hasRichFormatting([{ text: 'x', bold: true }])).toBe(true);
    expect(hasRichFormatting([{ text: 'a' }, { text: 'b', color: '#fff' }])).toBe(true);
  });
});
