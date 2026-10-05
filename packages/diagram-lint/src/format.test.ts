import { describe, expect, it } from 'vitest';
import type { LintFinding, LintReport } from '@livediagram/api-schema';
import { LINT_MAX_LINES_PER_CODE } from './constants';
import { formatLintReport, lintFooterPart, lintSummaryLine, lintVerdict } from './format';
import { quoteLabel } from './quote';

const report = (
  over: Partial<LintReport> = {},
  measures: Partial<LintReport['measures']> = {},
): LintReport => ({
  measures: {
    crossings: 0,
    behind: 0,
    overlaps: 0,
    extent: { width: 100, height: 50 },
    arrows: 0,
    boxes: 0,
    ...measures,
  },
  findings: [],
  counts: { error: 0, warning: 0, info: 0 },
  skipped: { crossings: false },
  ...over,
});

describe('formatLintReport', () => {
  it("prints the spec's example output byte for byte", () => {
    const findings: LintFinding[] = [
      {
        code: 'arrow-behind-box',
        severity: 'warning',
        refs: ['x', 'pay'],
        message: 'orders→bus passes behind pay',
        fix: 'drop the groups, or lines: angled',
      },
      {
        code: 'arrow-behind-box',
        severity: 'warning',
        refs: ['y', 'pay'],
        message: 'bus→notify passes behind pay',
        fix: 'drop the groups, or lines: angled',
      },
      {
        code: 'group-split-edges',
        severity: 'info',
        refs: ['core'],
        message: 'core: 12 of 13 arrows cross its border',
        fix: 'group by ownership, or drop the groups',
      },
    ];
    const text = formatLintReport(
      report(
        { findings, counts: { error: 0, warning: 2, info: 1 } },
        { crossings: 5, behind: 2, extent: { width: 1317, height: 1196 } },
      ),
    );
    expect(text).toBe(
      [
        '5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info',
        'W arrow-behind-box   orders→bus passes behind pay            fix: drop the groups, or lines: angled',
        'W arrow-behind-box   bus→notify passes behind pay            fix: drop the groups, or lines: angled',
        'I group-split-edges  core: 12 of 13 arrows cross its border  fix: group by ownership, or drop the groups',
      ].join('\n'),
    );
  });

  it('cuts each code at ten lines and counts the rest', () => {
    const one = (i: number): LintFinding => ({
      code: 'node-isolated',
      severity: 'warning',
      refs: [`n${i}`],
      message: `n${i} has no arrows`,
      fix: 'x',
    });
    const findings = Array.from({ length: LINT_MAX_LINES_PER_CODE + 3 }, (_, i) => one(i));
    const err: LintFinding = {
      code: 'duplicate-label',
      severity: 'info',
      refs: ['a'],
      message: 'm',
      fix: 'f',
    };
    const lines = formatLintReport(report({ findings: [...findings, err] })).split('\n');
    expect(lines).toHaveLength(1 + LINT_MAX_LINES_PER_CODE + 1 + 1);
    expect(lines[LINT_MAX_LINES_PER_CODE + 1]).toBe('… 3 more node-isolated');
    expect(lines.at(-1)).toMatch(/^I duplicate-label/);
  });

  it('caps the message column, letting a long message run past it', () => {
    const long: LintFinding = {
      code: 'edge-crossings',
      severity: 'warning',
      refs: [],
      message: 'x'.repeat(60),
      fix: 'f',
    };
    const short: LintFinding = {
      code: 'duplicate-label',
      severity: 'info',
      refs: [],
      message: 'short',
      fix: 'f',
    };
    const [, a, b] = formatLintReport(report({ findings: [long, short] })).split('\n');
    expect(a).toBe(`W edge-crossings     ${'x'.repeat(60)}  fix: f`);
    expect(b).toBe(`I duplicate-label    short${' '.repeat(43)}  fix: f`);
  });
});

describe('summary line and verdict', () => {
  it('says clean, counts in the singular and plural, and empty for nothing drawn', () => {
    expect(lintSummaryLine(report({}, { extent: null }))).toBe(
      '0 crossings · 0 behind · 0 overlaps · empty → clean',
    );
    const one = report(
      { counts: { error: 1, warning: 1, info: 1 } },
      { crossings: 1, overlaps: 1, behind: 1 },
    );
    expect(lintSummaryLine(one)).toBe(
      '1 crossing · 1 behind · 1 overlap · 100×50 → 1 error, 1 warning, 1 info',
    );
    expect(lintVerdict(report({ counts: { error: 2, warning: 0, info: 3 } }))).toBe(
      '2 errors, 3 info',
    );
  });

  it('says how many arrows a skipped crossing check had', () => {
    expect(
      lintSummaryLine(report({ skipped: { crossings: true } }, { crossings: null, arrows: 412 })),
    ).toMatch(/^crossings skipped \(412 arrows\) · /);
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
