import { describe, expect, it } from 'vitest';
import {
  AREAS,
  REPORT_END,
  REPORT_START,
  coverageDiffBlock,
  coverageOf,
  failureReason,
  patchLine,
  pctDelta,
  renderReport,
  sumTotals,
  treeGraph,
  withReport,
} from '../../../scripts/coverage-report.mjs';

// scripts/coverage-report.mjs writes the pull request's coverage report into its description from Codecov's public API
// (docs/specs/003-system-architecture/testing.md "Coverage report"). It lives here with the other
// repo-wide guards because scripts/ belongs to no workspace.

const totals = (lines: number, hits: number, misses: number, partials: number, files = 1) => ({
  files,
  lines,
  hits,
  misses,
  partials,
});

describe('sumTotals', () => {
  it('adds every count across paths', () => {
    expect(sumTotals([totals(10, 6, 3, 1, 2), totals(5, 5, 0, 0, 1)])).toEqual(
      totals(15, 11, 3, 1, 3),
    );
  });

  it('is all zeroes for no paths', () => {
    expect(sumTotals([])).toEqual(totals(0, 0, 0, 0, 0));
  });
});

describe('coverageOf', () => {
  it('is hits over coverable lines, as Codecov reckons it', () => {
    expect(coverageOf(totals(52049, 27083, 21643, 3323))).toBeCloseTo(52.03, 2);
  });

  it('is null when nothing is coverable', () => {
    expect(coverageOf(totals(0, 0, 0, 0))).toBeNull();
  });
});

describe('pctDelta', () => {
  it('signs a rise and a fall to two places', () => {
    expect(pctDelta(60.61, 60.62)).toBe('+0.01%');
    expect(pctDelta(60.62, 60.5)).toBe('-0.12%');
  });

  it('is blank for no change, or a side with nothing coverable', () => {
    expect(pctDelta(60.611, 60.612)).toBe('');
    expect(pctDelta(null, 50)).toBe('');
  });
});

describe('patchLine', () => {
  it('says so when no coverable line changed', () => {
    expect(patchLine(null)).toContain('No coverable lines changed');
    expect(patchLine({ hits: 0, misses: 0, partials: 0 })).toContain('No coverable lines changed');
  });

  it('passes a fully covered patch', () => {
    expect(patchLine({ hits: 4, misses: 0, partials: 0 })).toBe(
      ':white_check_mark: Patch coverage is 100.00%: every changed coverable line is covered.',
    );
  });

  it('counts misses and partials as lines not covered', () => {
    expect(patchLine({ hits: 6, misses: 3, partials: 1 })).toBe(
      ':warning: Patch coverage is 60.00%, with 4 changed lines not covered.',
    );
    expect(patchLine({ hits: 1, misses: 1, partials: 0 })).toContain('1 changed line not covered');
  });
});

describe('coverageDiffBlock', () => {
  const block = coverageDiffBlock(
    totals(100, 60, 30, 10, 3),
    totals(110, 70, 28, 12, 4),
    'main',
    '#9',
  );
  const row = (label: string) => block.split('\n').find((l) => l.slice(2).startsWith(label))!;

  it('is a diff fence headed by both sides', () => {
    expect(block.startsWith('```diff\n')).toBe(true);
    expect(block.endsWith('\n```')).toBe(true);
    expect(block).toContain('Coverage Diff');
    expect(block.split('\n')[2]).toMatch(/^##\s+main\s+#9\s+\+\/-$/);
  });

  it('marks improvements with + and regressions with -', () => {
    expect(row('Coverage').startsWith('+ ')).toBe(true);
    expect(row('Hits').startsWith('+ ')).toBe(true);
    expect(row('Misses').startsWith('+ ')).toBe(true);
    expect(row('Partials').startsWith('- ')).toBe(true);
  });

  it('leaves counts that cannot be better or worse unmarked, with their change', () => {
    expect(row('Files')).toMatch(/^ {2}Files\s+3\s+4\s+\+1$/);
    expect(row('Lines')).toMatch(/^ {2}Lines\s+100\s+110\s+\+10$/);
  });

  it('shows no change as blank and unmarked', () => {
    const same = coverageDiffBlock(totals(10, 5, 5, 0), totals(10, 5, 5, 0), 'main', '#1');
    expect(same).not.toMatch(/^[+-] /m);
  });
});

describe('renderReport', () => {
  const report = renderReport({
    pr: 9,
    baseSha: 'abcdef1234',
    headSha: '1234567890',
    base: totals(100, 60, 30, 10),
    head: totals(100, 61, 29, 10),
    patch: { hits: 1, misses: 0, partials: 0 },
    areas: [{ name: 'Editor', base: totals(50, 25, 25, 0), head: totals(50, 26, 24, 0) }],
    codecovUrl: 'https://app.codecov.io/gh/o/r/pull/9',
  });

  it('opens with its heading, linked to Codecov', () => {
    expect(report.startsWith('## [Coverage](https://app.codecov.io/gh/o/r/pull/9) report\n')).toBe(
      true,
    );
  });

  it('states project coverage and the two commits compared', () => {
    expect(report).toContain('Project coverage is 61.00% (+1.00%)');
    expect(report).toContain('`main` at `abcdef1`');
    expect(report).toContain('with `1234567`');
  });

  it('has a row per area and the coverage diff', () => {
    expect(report).toContain('| Editor | 50.00% | 52.00% | +2.00% |');
    expect(report).toContain('```diff');
  });
});

describe('treeGraph', () => {
  const url = 'https://app.codecov.io/gh/o/r/pull/9';

  it('embeds the Codecov tree graph, linked to the file tree of the pull request', () => {
    expect(treeGraph(url, 'TOK EN')).toBe(
      '[![Impacted file tree graph](https://app.codecov.io/gh/o/r/pull/9/graphs/tree.svg?width=650&height=150&src=pr&token=TOK%20EN)](https://app.codecov.io/gh/o/r/pull/9?src=pr&el=tree)',
    );
  });

  it('is left out without a graph token', () => {
    expect(treeGraph(url, null)).toBeNull();
    const report = renderReport({
      pr: 9,
      baseSha: 'a',
      headSha: 'b',
      base: totals(1, 1, 0, 0),
      head: totals(1, 1, 0, 0),
      patch: null,
      areas: [],
      codecovUrl: url,
    });
    expect(report).not.toContain('tree.svg');
  });

  it('sits between the summary and the area table', () => {
    const report = renderReport({
      pr: 9,
      baseSha: 'a',
      headSha: 'b',
      base: totals(1, 1, 0, 0),
      head: totals(1, 1, 0, 0),
      patch: null,
      areas: [],
      codecovUrl: url,
      graphToken: 'T',
    });
    expect(report.indexOf('Project coverage')).toBeLessThan(report.indexOf('tree.svg'));
    expect(report.indexOf('tree.svg')).toBeLessThan(report.indexOf('| Area |'));
  });
});

describe('withReport', () => {
  const block = (report: string) => `${REPORT_START}\n\n---\n\n${report}\n\n${REPORT_END}`;

  it('appends the report below a separator, leaving the description intact', () => {
    expect(withReport('Fixes the thing.\n\n', 'R1')).toBe(`Fixes the thing.\n\n${block('R1')}`);
  });

  it('is the report alone for an empty description', () => {
    expect(withReport(null, 'R1')).toBe(block('R1'));
    expect(withReport('  \n', 'R1')).toBe(block('R1'));
  });

  it('replaces an earlier report in place, keeping text around it', () => {
    const body = `Intro\r\n\r\n${block('R1')}\r\n\r\nAfterword`;
    expect(withReport(body, 'R2')).toBe(`Intro\r\n\r\n${block('R2')}\r\n\r\nAfterword`);
  });

  it('is unchanged when the report is the same, so nothing is written', () => {
    const body = withReport('Intro', 'R1');
    expect(withReport(body, 'R1')).toBe(body);
  });

  it('replaces to the end when the closing marker was edited away', () => {
    expect(withReport(`Intro\n\n${REPORT_START}\nstale`, 'R2')).toBe(`Intro\n\n${block('R2')}`);
  });
});

describe('AREAS', () => {
  it('names every app and package tree that uploads coverage, each once', () => {
    const paths = AREAS.flatMap((a) => a.paths);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of [
      'apps/live',
      'apps/api',
      'apps/mcp',
      'apps/help',
      'apps/marketing',
      'packages',
    ]) {
      expect(paths).toContain(p);
    }
  });
});

describe('failureReason', () => {
  it('names the network cause undici hides behind "fetch failed"', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.codecov.io'), {
      code: 'ENOTFOUND',
    });
    expect(failureReason(new TypeError('fetch failed', { cause }))).toBe(
      'fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND api.codecov.io)',
    );
    expect(
      failureReason(new TypeError('fetch failed', { cause: new Error('socket hang up') })),
    ).toBe('fetch failed (socket hang up)');
  });

  it('is the message alone without a cause, and the value itself for a non-error', () => {
    expect(failureReason(new Error('answered 502'))).toBe('answered 502');
    expect(failureReason('boom')).toBe('boom');
  });
});
