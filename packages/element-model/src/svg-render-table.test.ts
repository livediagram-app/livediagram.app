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

  // docs/specs/009-elements/comparison-tables.md: marks and the highlighted column are livedocuments' alone.
  describe('comparison tables', () => {
    const table = {
      ...createTable(0, 0, 3, 2),
      width: 200,
      height: 120,
      headerRow: true,
      zebra: true,
      cells: [
        ['Plan', 'Pro'],
        ['Sync', '✓'],
        ['Ads', '✗'],
      ],
      highlightColumn: 1,
    };

    it('draws the grid alone unless the product asks for comparison tables', () => {
      const svg = svgTableShape(table);
      expect(svg).not.toContain('<circle');
      expect(svg).toContain('>✓<');
    });

    it('draws a tick or cross cell as a mark and frames the highlighted column', () => {
      const svg = svgTableShape(table, 'light', { comparison: true });
      expect((svg.match(/<circle\b/g) ?? []).length).toBe(2);
      expect(svg).not.toContain('>✓<');
      expect(svg).toContain('stroke-width="2"/>');
    });

    it('places marks by the alignment and ignores a column past the last', () => {
      for (const [x, y] of [
        ['left', 'top'],
        ['right', 'bottom'],
      ] as const) {
        const svg = svgTableShape(
          { ...table, textAlignX: x, textAlignY: y, highlightColumn: 5 },
          'dark',
          { comparison: true },
        );
        expect((svg.match(/<circle\b/g) ?? []).length).toBe(2);
      }
    });
  });
});
