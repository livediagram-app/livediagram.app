import { describe, expect, it } from 'vitest';
import { svgTableShape, tableTrackSizes } from './svg-render-table';
import { createTable } from './testing/elements';

// docs/specs/020-import-export/export-fidelity.md: a table cell's text breaks a word wider than its cell, in every
// product's export.

const textRuns = (svg: string) =>
  (svg.match(/<text\b/g) ?? []).length + (svg.match(/<tspan\b/g) ?? []).length;

describe('svgTableShape', () => {
  it('breaks a word wider than its cell rather than running into the next cell', () => {
    const table = { ...createTable(0, 0, 1, 2), width: 120, height: 80 };
    const short = svgTableShape({ ...table, cells: [['Word', '']] });
    const long = svgTableShape({
      ...table,
      cells: [['Extraordinarilylongwordwithoutanyspaces', '']],
    });
    expect(textRuns(long)).toBeGreaterThan(textRuns(short));
  });

  it('draws nothing for a table with no cells', () => {
    expect(svgTableShape({ ...createTable(0, 0), cells: [] })).toBe('');
    const { cells: _cells, ...noCells } = createTable(0, 0);
    expect(svgTableShape(noCells)).toBe('');
  });

  it('shares what is left between the unpinned tracks', () => {
    expect(tableTrackSizes(300, 3, [100, null, null])).toEqual([100, 100, 100]);
  });
});
