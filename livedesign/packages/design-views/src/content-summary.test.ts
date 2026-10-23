import { describe, expect, it } from 'vitest';
import { createTable, createText, type Element } from '@livedesign/design';
import { shapeAt } from './__fixtures__/build';
import { contentSummaryOf } from './content-summary';

const shape = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown>) =>
  ({ ...shapeAt(kind, 'x', 0, 0), ...extra }) as Element;

describe('contentSummaryOf (R14)', () => {
  it('sizes a table and prints its header row, ragged rows padded (E26)', () => {
    const table = {
      ...createTable(0, 0),
      cells: [['Service', 'p99 | p50'], ['a', 'b', 'c'], 'junk'],
    } as unknown as Element;
    expect(contentSummaryOf(table)).toBe('3x3 Service | p99 \\| p50 | ');
    const odd = { ...createTable(0, 0), cells: [[1, 'x']] } as unknown as Element;
    expect(contentSummaryOf(odd)).toBe('1x2  | x');
    expect(contentSummaryOf({ ...createTable(0, 0), cells: [] })).toBe('0x0');
    expect(contentSummaryOf({ ...createTable(0, 0), cells: [[]] })).toBe('1x0');
  });

  it('gives a code block its language and line count (VW20)', () => {
    expect(contentSummaryOf(shape('code-block', { code: 'a\nb\nc', codeLanguage: 'ts' }))).toBe(
      'lang=ts lines=3',
    );
    expect(contentSummaryOf(shape('code-block', { code: '', codeLanguage: undefined }))).toBe(
      'lang=plain lines=0',
    );
    expect(contentSummaryOf(shape('code-block', { code: undefined }))).toMatch(/ lines=0$/);
  });

  it('counts chart slices and series (VW21)', () => {
    expect(contentSummaryOf(shape('pie-chart', { pieSlices: [{}, {}] }))).toBe('slices=2');
    expect(contentSummaryOf(shape('bar-chart', { pieSlices: [{}] }))).toBe('slices=1');
    expect(
      contentSummaryOf(shape('line-chart', { lineSeries: [{}], lineCategories: ['a', 'b'] })),
    ).toBe('series=1 x=2');
  });

  it("counts a checklist's done items", () => {
    const items = [{ text: 'a', done: true }, { text: 'b', done: false }, null];
    expect(contentSummaryOf(shape('checklist', { checklistItems: items }))).toBe('done=1/2');
  });

  it('has nothing to say about other kinds', () => {
    expect(contentSummaryOf(shapeAt('square', 'x', 0, 0))).toBeNull();
    expect(contentSummaryOf(createText(0, 0))).toBeNull();
  });

  it("counts a Sankey's flows and the distinct nodes they join, as the diagram matches names", () => {
    expect(
      contentSummaryOf(
        shape('sankey', {
          sankeyFlows: [
            { from: 'Salary', to: 'Budget ', value: 3 },
            { from: ' Budget', to: 'Rent', value: 1 },
            { from: 'Rent' },
            'not a flow',
          ],
        }),
      ),
    ).toBe('flows=3 nodes=3');
  });

  it("lists a concept graphic's rows in order, and a pyramid's variant (docs/specs/009-elements/concept-graphics.md)", () => {
    const rows = [{ label: 'Visited', note: '12,400' }, { label: 'Signed up' }, { label: 'a|b' }];
    expect(
      contentSummaryOf(shape('pyramid', { conceptRows: rows, pyramidVariant: 'funnel' })),
    ).toBe('rows=Visited|Signed up|a\\|b variant=funnel');
    expect(contentSummaryOf(shape('cycle', { conceptRows: [{ label: 'Plan' }, {}] }))).toBe(
      'rows=Plan|?',
    );
    expect(contentSummaryOf(shape('layer-stack', { conceptRows: undefined }))).toBe('rows=');
    expect(contentSummaryOf(shape('chevrons', { conceptRows: [{ label: 'Build' }] }))).toBe(
      'rows=Build',
    );
  });

  it("names a stack's direction, a row when unset", () => {
    expect(contentSummaryOf(shape('stack', {}))).toBe('direction=row');
  });
});
