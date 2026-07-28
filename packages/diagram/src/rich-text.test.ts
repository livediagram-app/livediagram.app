import { describe, expect, it } from 'vitest';
import {
  applyFormatToRange,
  applyHeadingToLines,
  applyListStyle,
  expandRangeToLines,
  hasRichFormatting,
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  setRunsPlainText,
  stripListPrefixes,
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

describe('applyListStyle / stripListPrefixes', () => {
  it('bullets every non-empty line', () => {
    const runs = applyListStyle(runsFromPlainText('a\nb'), 'bullet');
    expect(runsPlainText(runs)).toBe('• a\n• b');
  });

  it('numbers lines sequentially, skipping blank lines', () => {
    const runs = applyListStyle(runsFromPlainText('a\n\nb'), 'numbered');
    expect(runsPlainText(runs)).toBe('1. a\n\n2. b');
  });

  it('renumbers / re-markers on re-apply rather than stacking', () => {
    const once = applyListStyle(runsFromPlainText('a\nb\nc'), 'numbered');
    const bulleted = applyListStyle(once, 'bullet');
    expect(runsPlainText(bulleted)).toBe('• a\n• b\n• c');
  });

  it('with a range, only marks the lines the range touches', () => {
    // "a\nb\nc": offsets a=0, \n=1, b=2, \n=3, c=4. Range over line 2 ("b").
    const runs = applyListStyle(runsFromPlainText('a\nb\nc'), 'bullet', { start: 2, end: 3 });
    expect(runsPlainText(runs)).toBe('a\n• b\nc');
  });

  it("'none' strips existing markers", () => {
    const bulleted = applyListStyle(runsFromPlainText('a\nb'), 'bullet');
    expect(runsPlainText(applyListStyle(bulleted, 'none'))).toBe('a\nb');
    expect(runsPlainText(stripListPrefixes(bulleted))).toBe('a\nb');
  });

  it('preserves run formatting on the line body (marker stays unformatted)', () => {
    const runs = applyListStyle([{ text: 'a\n' }, { text: 'b', bold: true }], 'bullet');
    expect(runsPlainText(runs)).toBe('• a\n• b');
    // The bold "b" survives as its own run; no marker run is bold.
    expect(runs.some((r) => r.text === 'b' && r.bold === true)).toBe(true);
    expect(runs.every((r) => !r.text.includes('•') || r.bold === undefined)).toBe(true);
  });
});

describe('link + heading run attributes (spec/92)', () => {
  it('splits and merges on link like any other attribute', () => {
    const runs = applyFormatToRange(runsFromPlainText('see the docs'), 4, 12, {
      link: 'https://example.com',
    });
    expect(runs).toEqual([{ text: 'see ' }, { text: 'the docs', link: 'https://example.com' }]);
    // Clearing re-merges into one plain run.
    expect(applyFormatToRange(runs, 0, 12, { link: undefined })).toEqual([
      { text: 'see the docs' },
    ]);
  });

  it('does not merge adjacent runs that point at different links', () => {
    const runs = normalizeRuns([
      { text: 'a', link: 'https://a.example' },
      { text: 'b', link: 'https://b.example' },
    ]);
    expect(runs).toHaveLength(2);
  });

  it('counts as rich formatting', () => {
    expect(hasRichFormatting([{ text: 'x', link: 'https://example.com' }])).toBe(true);
    expect(hasRichFormatting([{ text: 'x', heading: 1 }])).toBe(true);
  });
});

describe('expandRangeToLines', () => {
  const text = 'one\ntwo\nthree';

  it('grows a mid-line range out to the whole line', () => {
    expect(expandRangeToLines(text, { start: 5, end: 6 })).toEqual({ start: 4, end: 7 });
  });

  it('resolves a collapsed caret to the line it sits on', () => {
    expect(expandRangeToLines(text, { start: 0, end: 0 })).toEqual({ start: 0, end: 3 });
    expect(expandRangeToLines(text, { start: 9, end: 9 })).toEqual({ start: 8, end: 13 });
  });

  it('spans every line a multi-line range touches, and clamps', () => {
    expect(expandRangeToLines(text, { start: 2, end: 9 })).toEqual({ start: 0, end: 13 });
    expect(expandRangeToLines(text, { start: 99, end: 99 })).toEqual({ start: 8, end: 13 });
  });

  it('normalises a backwards range', () => {
    expect(expandRangeToLines(text, { start: 6, end: 5 })).toEqual({ start: 4, end: 7 });
  });
});

describe('applyHeadingToLines', () => {
  it('marks every character of the touched line, not just the selection', () => {
    const runs = applyHeadingToLines(runsFromPlainText('Title\nbody'), 1, { start: 1, end: 2 });
    expect(runs).toEqual([{ text: 'Title', heading: 1 }, { text: '\nbody' }]);
  });

  it('spans several lines when the range does', () => {
    const runs = applyHeadingToLines(runsFromPlainText('a\nb\nc'), 2, { start: 0, end: 3 });
    expect(runsPlainText(runs)).toBe('a\nb\nc');
    expect(runs[0]).toEqual({ text: 'a\nb', heading: 2 });
  });

  it('clears with null and leaves the rest of the formatting alone', () => {
    const heading = applyHeadingToLines([{ text: 'Title', bold: true }], 1);
    expect(heading).toEqual([{ text: 'Title', bold: true, heading: 1 }]);
    expect(applyHeadingToLines(heading, null)).toEqual([{ text: 'Title', bold: true }]);
  });

  it('is a no-op on an empty line', () => {
    const runs = applyHeadingToLines(runsFromPlainText('a\n\nb'), 1, { start: 2, end: 2 });
    expect(runs).toEqual([{ text: 'a\n\nb' }]);
  });
});
