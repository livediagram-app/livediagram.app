import { describe, expect, it } from 'vitest';
import type { LintFinding, LintReport } from '@livedesign/api-schema';
import { LINT_MAX_LINES_PER_CODE } from './constants';
import { formatLintReport, lintFooterPart, lintSummaryLine, lintVerdict } from './format';
import { quoteLabel } from './quote';

const report = (
  over: Partial<LintReport> = {},
  measures: Partial<LintReport['measures']> = {},
): LintReport => ({
  measures: { extent: { width: 100, height: 50 }, boxes: 0, texts: 0, ...measures },
  findings: [],
  counts: { error: 0, warning: 0, info: 0 },
  ...over,
});

describe('formatLintReport', () => {
  it("prints the spec's example output byte for byte", () => {
    const findings: LintFinding[] = [
      {
        code: 'label-overflow',
        severity: 'warning',
        refs: ['b3'],
        message: 'b3 needs 3 lines, holds 2',
        fix: 'set b3 text=sm',
      },
      {
        code: 'text-overflow',
        severity: 'warning',
        refs: ['h1', 's2'],
        message: 'h1 prints over s2',
        fix: 'move s2 below:h1',
      },
    ];
    const text = formatLintReport(
      report(
        { findings, counts: { error: 0, warning: 2, info: 0 } },
        { extent: { width: 1440, height: 900 }, boxes: 12, texts: 30 },
      ),
    );
    expect(text).toBe(
      [
        '1440×900 · 12 boxes · 30 texts → 2 warnings',
        'W label-overflow  b3 needs 3 lines, holds 2  fix: set b3 text=sm',
        'W text-overflow   h1 prints over s2          fix: move s2 below:h1',
      ].join('\n'),
    );
  });

  it('cuts each code at ten lines and counts the rest', () => {
    const one = (i: number): LintFinding => ({
      code: 'label-overflow',
      severity: 'warning',
      refs: [`n${i}`],
      message: `n${i} needs 2 lines, holds 1`,
      fix: 'x',
    });
    const findings = Array.from({ length: LINT_MAX_LINES_PER_CODE + 3 }, (_, i) => one(i));
    const last: LintFinding = {
      code: 'text-overflow',
      severity: 'warning',
      refs: ['a'],
      message: 'm',
      fix: 'f',
    };
    const lines = formatLintReport(report({ findings: [...findings, last] })).split('\n');
    expect(lines).toHaveLength(1 + LINT_MAX_LINES_PER_CODE + 1 + 1);
    expect(lines[LINT_MAX_LINES_PER_CODE + 1]).toBe('… 3 more label-overflow');
    expect(lines.at(-1)).toMatch(/^W text-overflow/);
  });

  it('caps the message column, letting a long message run past it', () => {
    const long: LintFinding = {
      code: 'label-overflow',
      severity: 'warning',
      refs: [],
      message: 'x'.repeat(60),
      fix: 'f',
    };
    const short: LintFinding = {
      code: 'text-overflow',
      severity: 'info',
      refs: [],
      message: 'short',
      fix: 'f',
    };
    const [, a, b] = formatLintReport(report({ findings: [long, short] })).split('\n');
    expect(a).toBe(`W label-overflow  ${'x'.repeat(60)}  fix: f`);
    expect(b).toBe(`I text-overflow   short${' '.repeat(43)}  fix: f`);
  });
});

describe('summary line and verdict', () => {
  it('says clean, counts in the singular and plural, and empty for nothing drawn', () => {
    expect(lintSummaryLine(report({}, { extent: null }))).toBe('empty · 0 boxes · 0 texts → clean');
    const one = report({ counts: { error: 1, warning: 1, info: 1 } }, { boxes: 1, texts: 1 });
    expect(lintSummaryLine(one)).toBe('100×50 · 1 box · 1 text → 1 error, 1 warning, 1 info');
    expect(lintVerdict(report({ counts: { error: 2, warning: 0, info: 3 } }))).toBe(
      '2 errors, 3 info',
    );
  });

  it('gives the footer its part, or unavailable', () => {
    expect(lintFooterPart(report())).toBe('lint clean');
    expect(lintFooterPart(report({ counts: { error: 0, warning: 2, info: 1 } }))).toBe(
      'lint 2 warnings, 1 info',
    );
    expect(lintFooterPart(null)).toBe('lint unavailable');
  });
});

describe('quoteLabel', () => {
  it('strips controls, collapses whitespace, cuts and escapes (N19)', () => {
    expect(quoteLabel('Orders\u0007\u009b  "DB"\n')).toBe('"Orders \\"DB\\""');
    expect(quoteLabel('a'.repeat(50))).toBe(`"${'a'.repeat(39)}…"`);
    expect(quoteLabel('Short')).toBe('"Short"');
  });
});
