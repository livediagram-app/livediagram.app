import { describe, expect, it } from 'vitest';
import { createText, type Element } from '@livehuddle/document';
import { retiredShapeAt, shapeAt, storedTableAt } from './__fixtures__/build';
import { contentSummaryOf } from './content-summary';

const shape = (kind: Parameters<typeof shapeAt>[0], extra: Record<string, unknown>) =>
  ({ ...shapeAt(kind, 'x', 0, 0), ...extra }) as Element;

describe('contentSummaryOf (R14)', () => {
  it('has nothing to say about other kinds', () => {
    expect(contentSummaryOf(shapeAt('square', 'x', 0, 0))).toBeNull();
    // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md) has no summary, whatever it stored.
    for (const [kind, extra] of [
      ['code-block', { code: 'a\nb', codeLanguage: 'ts' }],
      ['pie-chart', { pieSlices: [{}, {}] }],
      ['line-chart', { lineSeries: [{}], lineCategories: ['a'] }],
      ['checklist', { checklistItems: [{ text: 'a', done: true }] }],
    ] as const) {
      expect(contentSummaryOf(retiredShapeAt(kind, 'x', 0, 0, 100, 50, extra))).toBeNull();
    }
    expect(contentSummaryOf(createText(0, 0))).toBeNull();
    // Nor a stored table (part 2 of the element engine), whatever its cells hold.
    expect(contentSummaryOf(storedTableAt(0, 0))).toBeNull();
  });

  it("lists a timeline's milestones in order, and a stack's direction", () => {
    const rows = [{ label: 'Kick-off' }, {}, { label: 'a|b' }];
    expect(contentSummaryOf(shape('timeline-rail', { conceptRows: rows }))).toBe(
      'rows=Kick-off|?|a\\|b',
    );
    expect(contentSummaryOf(shape('stack', {}))).toBe('direction=row');
    expect(contentSummaryOf(shape('stack', { stackDirection: 'column' }))).toBe('direction=column');
  });
});
