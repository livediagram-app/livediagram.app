import { describe, expect, it } from 'vitest';
import type { Element, Tab } from './index';
import { chartTextLines } from './chart-text';
import { tabToMarkdownText } from './export-tab-text';
import { mermaidFromTab } from './mermaid-serialise';

const shape = (id: string, over: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
});

const pie = shape('p', {
  shape: 'pie-chart',
  pieSlices: [
    { label: 'Apples', value: 30 },
    { label: ' Pears ', value: 0.1 + 0.2 },
    { label: '', value: 5 },
  ],
});
const line = shape('l', {
  shape: 'line-chart',
  chartVariant: 'area',
  y: 300,
  lineCategories: ['Jan', 'Feb'],
  lineSeries: [
    { name: 'Revenue', values: [10, 25, 7] },
    { name: '', values: [] },
    { name: 'Stored without values' },
  ],
});

describe('chartTextLines', () => {
  it('reads a pie or bar chart as its type over a line per slice', () => {
    expect(chartTextLines(pie)).toEqual({
      heading: 'Pie Chart',
      rows: ['Apples: 30', 'Pears: 0.3', '?: 5'],
    });
    expect(chartTextLines(shape('b', { shape: 'bar-chart' }))).toEqual({
      heading: 'Column Chart',
      rows: [],
    });
  });

  it('reads a line chart as a line per series, each value under its category', () => {
    expect(chartTextLines(line)).toEqual({
      heading: 'Area Chart',
      rows: ['Revenue: Jan 10, Feb 25, 7', 'Series: ', 'Stored without values: '],
    });
    expect(chartTextLines(shape('l2', { shape: 'line-chart' }))?.rows).toEqual([]);
  });

  it('reads a legend as its named rows and a Sankey diagram as its flows', () => {
    expect(
      chartTextLines(
        shape('g', { shape: 'legend', legendItems: [{ label: 'Done' }, { label: ' ' }] }),
      ),
    ).toEqual({ heading: 'Legend', rows: ['Done'] });
    expect(chartTextLines(shape('g2', { shape: 'legend' }))?.rows).toEqual([]);
    expect(
      chartTextLines(
        shape('s', {
          shape: 'sankey',
          sankeyFlows: [{ from: 'Salary', to: 'Rent', value: Number.NaN }],
        }),
      ),
    ).toEqual({ heading: 'Sankey Diagram', rows: ['Salary → Rent: '] });
    expect(chartTextLines(shape('s2', { shape: 'sankey' }))?.rows).toEqual([]);
  });

  it('is null for anything that draws no data', () => {
    expect(chartTextLines(shape('q'))).toBeNull();
    expect(chartTextLines({ id: 't', type: 'text', x: 0, y: 0, width: 1, height: 1 })).toBeNull();
  });
});

describe('charts in the text exports', () => {
  const tab = (elements: Element[]): Tab => ({ name: 'Numbers', elements }) as Tab;

  it('lists a tab of only charts in Markdown, each with its rows beneath', () => {
    const md = tabToMarkdownText(tab([line, pie]));
    expect(md).not.toContain('_No labelled content._');
    expect(md).toContain(
      [
        '## Elements',
        '',
        '- **Pie Chart** (pie-chart)',
        '  - Apples: 30',
        '  - Pears: 0.3',
        '  - ?: 5',
        '- **Area Chart** (line-chart)',
        '  - Revenue: Jan 10, Feb 25, 7',
      ].join('\n'),
    );
  });

  it('writes a chart in Mermaid as a square labelled with what it shows, never blank', () => {
    const out = mermaidFromTab(tab([pie]));
    expect(out).toContain('n1["Pie Chart<br/>Apples: 30<br/>Pears: 0.3<br/>?: 5"]');
    expect(out).not.toContain('[" "]');
  });
});
