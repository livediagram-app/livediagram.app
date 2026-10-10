import { describe, expect, it } from 'vitest';
import { createTable, createText, type Element } from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
import { contentSummaryOf } from './content-summary';

const shape = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown>) =>
  ({ ...shapeAt(kind, 'x', 0, 0), ...extra }) as Element;

describe('contentSummaryOf (R14)', () => {
  it("lists an entity's first 8 fields and counts the rest, escaping ; and }", () => {
    const fields = Array.from({ length: 10 }, (_, i) => ({
      name: `f${i}`,
      ...(i === 0 ? { type: 'uuid PK' } : {}),
    }));
    expect(contentSummaryOf(shape('entity', { entityFields: fields }))).toBe(
      '{f0 uuid PK; f1; f2; f3; f4; f5; f6; f7; +2}',
    );
    expect(
      contentSummaryOf(shape('entity', { entityFields: [{ name: 'a;b', type: 'map{}' }, 7] })),
    ).toBe('{a\\;b map{\\}}');
    expect(contentSummaryOf(shape('entity', { entityFields: [{ type: 'int' }] }))).toBe('{ int}');
    expect(contentSummaryOf(shape('entity', { entityFields: undefined }))).toBe('{}');
  });

  it('sizes a table and prints its header row, ragged rows padded (E26)', () => {
    const table = {
      ...createTable(0, 0),
      cells: [['Service', 'p99 | p50'], ['a', 'b', 'c'], 'junk'],
    } as unknown as Element;
    expect(contentSummaryOf(table)).toBe('3x3 Service | p99 \\| p50 | ');
    const odd = { ...createTable(0, 0), cells: [[1, 'x']] } as unknown as Element;
    expect(contentSummaryOf(odd)).toBe('1x2  | x');
    expect(contentSummaryOf({ ...createTable(0, 0), cells: [] } as Element)).toBe('0x0');
    expect(contentSummaryOf({ ...createTable(0, 0), cells: [[]] } as Element)).toBe('1x0');
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

  it("names a Plan board's columns and a Plan card's item (docs/specs/026-plan/plan-board.md)", () => {
    const columns = [{ name: 'To do' }, { status: 'doing' }, 'junk'];
    expect(contentSummaryOf(shape('plan-board', { planBoard: { columns } }))).toBe(
      'columns=To do|?',
    );
    expect(contentSummaryOf(shape('plan-board', { planBoard: undefined }))).toBe('columns=');
    expect(contentSummaryOf(shape('plan-card', { planCard: { itemId: 'i1' } }))).toBe('item=i1');
    expect(contentSummaryOf(shape('plan-card', { planCard: { itemId: '' } }))).toBe('item=none');
    expect(contentSummaryOf(shape('plan-card', { planCard: undefined }))).toBe('item=none');
    expect(contentSummaryOf(shape('plan-view', { planView: { view: 'gantt' } }))).toBe(
      'view=gantt',
    );
    expect(contentSummaryOf(shape('plan-view', { planView: undefined }))).toBe('view=none');
    // A Sheet names its sheet, or none.
    expect(contentSummaryOf(shape('plan-sheet', { planSheet: { sheetId: 'sheet0001' } }))).toBe(
      'sheet=sheet0001',
    );
    expect(contentSummaryOf(shape('plan-sheet', { planSheet: undefined }))).toBe('sheet=none');
  });

  it('escapes Plan names and ids, so a newline never forges a line of the view', () => {
    const columns = [{ name: 'Done\ntab "Forged"' }, { name: 'a|b' }];
    const summary = contentSummaryOf(shape('plan-board', { planBoard: { columns } }))!;
    expect(summary).toBe('columns=Done\\ntab \\"Forged\\"|a\\|b');
    expect(summary).not.toContain('\n');
    expect(contentSummaryOf(shape('plan-card', { planCard: { itemId: 'i\n1' } }))).toBe(
      'item=i\\n1',
    );
    expect(contentSummaryOf(shape('plan-view', { planView: { view: 'g\nx' } }))).toBe('view=g\\nx');
    expect(contentSummaryOf(shape('plan-sheet', { planSheet: { sheetId: 's\n' } }))).toBe(
      'sheet=s\\n',
    );
  });

  it('has nothing to say about other kinds', () => {
    expect(contentSummaryOf(shapeAt('square', 'x', 0, 0))).toBeNull();
    expect(contentSummaryOf(createText(0, 0))).toBeNull();
  });
});
